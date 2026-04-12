import { expect } from "chai";
import assert from "node:assert/strict";
import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

describe("PolicyControlledWallet", function () {
  let wallet: any;
  let owner: any;
  let policySigner: any;
  let executor: any;
  let recipient: any;
  let other: any;
  let token: any;

  beforeEach(async function () {
    [owner, policySigner, executor, recipient, other] =
      await hre.ethers.getSigners();

    const TokenFactory = await hre.ethers.getContractFactory("TestToken");
    token = await TokenFactory.deploy();

    const WalletFactory =
      await hre.ethers.getContractFactory("PolicyControlledWallet");
    wallet = await WalletFactory.deploy(
      owner.address,
      policySigner.address,
      executor.address
    );
  });

  async function signAuthorization(args: {
    intentId: string;
    asset: string;
    to: string;
    amount: bigint;
    authorizationNonce: bigint;
    authorizationDeadline: bigint;
  }): Promise<string> {
    return policySigner.signTypedData(
      {
        name: "StealthTrailsPolicyWallet",
        version: "1",
        chainId: 31337n,
        verifyingContract: wallet.target
      },
      {
        WithdrawalAuthorization: [
          { name: "intentId", type: "bytes32" },
          { name: "asset", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "authorizationNonce", type: "uint256" },
          { name: "authorizationDeadline", type: "uint256" }
        ]
      },
      args
    );
  }

  it("executes authorized native withdrawals and advances the nonce", async function () {
    const amount = hre.ethers.parseEther("1");
    const authorizationNonce = 0n;
    const latestBlock = await hre.ethers.provider.getBlock("latest");
    const authorizationDeadline = BigInt(latestBlock!.timestamp + 600);
    const intentId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("withdrawal_1"));

    await owner.sendTransaction({
      to: wallet.target,
      value: amount
    });

    const authorizationSignature = await signAuthorization({
      intentId,
      asset: hre.ethers.ZeroAddress,
      to: recipient.address,
      amount,
      authorizationNonce,
      authorizationDeadline
    });

    const recipientBalanceBefore = await hre.ethers.provider.getBalance(
      recipient.address
    );

    await wallet
      .connect(executor)
      .executeAuthorizedTransfer(
        intentId,
        hre.ethers.ZeroAddress,
        recipient.address,
        amount,
        authorizationNonce,
        authorizationDeadline,
        authorizationSignature
      );

    expect(await wallet.nextNonce()).to.equal(1n);
    expect(await hre.ethers.provider.getBalance(recipient.address)).to.equal(
      recipientBalanceBefore + amount
    );
  });

  it("executes authorized ERC20 withdrawals", async function () {
    const amount = hre.ethers.parseUnits("250", 18);
    const authorizationNonce = 0n;
    const latestBlock = await hre.ethers.provider.getBlock("latest");
    const authorizationDeadline = BigInt(latestBlock!.timestamp + 600);
    const intentId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("withdrawal_erc20"));

    await token.mint(wallet.target, amount);

    const authorizationSignature = await signAuthorization({
      intentId,
      asset: token.target,
      to: recipient.address,
      amount,
      authorizationNonce,
      authorizationDeadline
    });

    await wallet
      .connect(executor)
      .executeAuthorizedTransfer(
        intentId,
        token.target,
        recipient.address,
        amount,
        authorizationNonce,
        authorizationDeadline,
        authorizationSignature
      );

    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    expect(await wallet.nextNonce()).to.equal(1n);
  });

  it("rejects unauthorized executors and replayed authorizations", async function () {
    const amount = hre.ethers.parseEther("0.5");
    const authorizationNonce = 0n;
    const latestBlock = await hre.ethers.provider.getBlock("latest");
    const authorizationDeadline = BigInt(latestBlock!.timestamp + 600);
    const intentId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("withdrawal_replay"));

    await owner.sendTransaction({
      to: wallet.target,
      value: amount
    });

    const authorizationSignature = await signAuthorization({
      intentId,
      asset: hre.ethers.ZeroAddress,
      to: recipient.address,
      amount,
      authorizationNonce,
      authorizationDeadline
    });

    await assert.rejects(
      () =>
        wallet
          .connect(other)
          .executeAuthorizedTransfer(
            intentId,
            hre.ethers.ZeroAddress,
            recipient.address,
            amount,
            authorizationNonce,
            authorizationDeadline,
            authorizationSignature
          ),
      /InvalidAuthorizedExecutor/
    );

    await wallet
      .connect(executor)
      .executeAuthorizedTransfer(
        intentId,
        hre.ethers.ZeroAddress,
        recipient.address,
        amount,
        authorizationNonce,
        authorizationDeadline,
        authorizationSignature
      );

    await assert.rejects(
      () =>
        wallet
          .connect(executor)
          .executeAuthorizedTransfer(
            intentId,
            hre.ethers.ZeroAddress,
            recipient.address,
            amount,
            authorizationNonce,
            authorizationDeadline,
            authorizationSignature
          ),
      /InvalidAuthorizationNonce/
    );
  });
});
