import { expect } from "chai";
import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

const ONE_YEAR = 365 * 24 * 60 * 60;
const REWARD_TOLERANCE = hre.ethers.parseEther("0.000001");

async function increaseTime(seconds: number): Promise<void> {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await hre.network.provider.send("evm_mine");
}

function expectApproxEqual(
  actual: bigint,
  expected: bigint,
  tolerance: bigint = REWARD_TOLERANCE
): void {
  const delta = actual >= expected ? actual - expected : expected - actual;
  expect(delta).to.be.lte(tolerance);
}

describe("StakingPool invariants", function () {
  let stakingPool: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  async function expectPoolAccountingInvariant(
    fundedRewardsByPoolId: Map<number, bigint>
  ): Promise<void> {
    let expectedContractBalance = 0n;

    for (const [poolId, fundedRewards] of fundedRewardsByPoolId.entries()) {
      const pool = await stakingPool.pools(poolId);
      expectedContractBalance += pool.totalStaked + pool.rewardReserve;
      expectApproxEqual(pool.rewardReserve + pool.totalRewardsPaid, fundedRewards);
    }

    expect(await hre.ethers.provider.getBalance(stakingPool.target)).to.equal(
      expectedContractBalance
    );
  }

  beforeEach(async function () {
    const StakingPoolFactory =
      await hre.ethers.getContractFactory("StakingPool");
    stakingPool = await StakingPoolFactory.deploy();
    [owner, addr1, addr2] = await hre.ethers.getSigners();
  });

  it("invariant: contract balance always equals tracked principal plus unfunded rewards after mixed pool activity", async function () {
    const fundedRewardsByPoolId = new Map<number, bigint>([
      [1, hre.ethers.parseEther("5")],
      [2, hre.ethers.parseEther("3")]
    ]);

    await stakingPool.createPool(10, 42);
    await stakingPool.createPool(20, 84);

    await stakingPool.fundPoolRewards(1, {
      value: fundedRewardsByPoolId.get(1)
    });
    await stakingPool.fundPoolRewards(2, {
      value: fundedRewardsByPoolId.get(2)
    });

    await stakingPool.connect(addr1).deposit(1, hre.ethers.parseEther("10"), {
      value: hre.ethers.parseEther("10")
    });
    await stakingPool.connect(addr2).deposit(1, hre.ethers.parseEther("4"), {
      value: hre.ethers.parseEther("4")
    });
    await stakingPool.connect(addr1).deposit(2, hre.ethers.parseEther("2"), {
      value: hre.ethers.parseEther("2")
    });

    await increaseTime(ONE_YEAR);

    await stakingPool.connect(addr1).claimReward(1);
    await stakingPool.connect(addr2).withdraw(1, hre.ethers.parseEther("1"));
    await stakingPool.connect(addr1).withdraw(2, hre.ethers.parseEther("2"));

    await expectPoolAccountingInvariant(fundedRewardsByPoolId);
  });

  it("invariant: emergency withdrawal preserves reward reserve conservation and clears principal exposure", async function () {
    const fundedRewardsByPoolId = new Map<number, bigint>([
      [1, hre.ethers.parseEther("2")]
    ]);

    await stakingPool.createPool(10, 42);
    await stakingPool.fundPoolRewards(1, {
      value: fundedRewardsByPoolId.get(1)
    });
    await stakingPool.connect(addr1).deposit(1, hre.ethers.parseEther("3"), {
      value: hre.ethers.parseEther("3")
    });
    await increaseTime(ONE_YEAR);

    await stakingPool.connect(addr1).emergencyWithdraw(1);

    const pool = await stakingPool.pools(1);
    expect(pool.totalStaked).to.equal(0n);
    expect(await stakingPool.getStakedBalance(addr1.address, 1)).to.equal(0n);
    await expectPoolAccountingInvariant(fundedRewardsByPoolId);
  });

  it("invariant: paused deposits never block exits or distort pool accounting", async function () {
    const fundedRewardsByPoolId = new Map<number, bigint>([
      [1, hre.ethers.parseEther("1")]
    ]);

    await stakingPool.createPool(10, 42);
    await stakingPool.fundPoolRewards(1, {
      value: fundedRewardsByPoolId.get(1)
    });
    await stakingPool.connect(addr1).deposit(1, hre.ethers.parseEther("2"), {
      value: hre.ethers.parseEther("2")
    });
    await stakingPool.setPoolDepositPause(1, true);
    await increaseTime(ONE_YEAR);

    await stakingPool.connect(addr1).claimReward(1);
    await stakingPool.connect(addr1).withdraw(1, hre.ethers.parseEther("2"));

    const pool = await stakingPool.pools(1);
    expect(pool.totalStaked).to.equal(0n);
    expect(pool.rewardReserve + pool.totalRewardsPaid).to.equal(
      fundedRewardsByPoolId.get(1)
    );
    await expectPoolAccountingInvariant(fundedRewardsByPoolId);
  });
});
