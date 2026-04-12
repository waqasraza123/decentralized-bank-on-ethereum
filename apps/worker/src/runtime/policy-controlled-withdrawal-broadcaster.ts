import {
  createPolicyControlledWalletReadContract,
  createPolicyControlledWalletWriteContract,
  createJsonRpcProvider,
  hashPolicyControlledIntentId,
  parseAssetAmount,
  signPolicyControlledWithdrawalAuthorization
} from "@stealth-trails-bank/contracts-sdk";
import { ethers } from "ethers";
import { ManagedExecutionIntentError } from "./deposit-broadcaster";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  DepositBroadcastResult,
  PolicyControlledWithdrawalBroadcaster,
  WorkerIntentProjection
} from "./worker-types";

type PolicyControlledWithdrawalTransferPlan = {
  walletAddress: string;
  destinationAddress: string;
  assetAddress: string;
  amount: ethers.BigNumber;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function describeBroadcastError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (isRecord(error)) {
    const message = error["message"];

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Unknown broadcast error.";
}

function isAlreadyKnownBroadcastError(error: unknown): boolean {
  const message = describeBroadcastError(error).toLowerCase();

  return (
    message.includes("already known") ||
    message.includes("known transaction") ||
    message.includes("already imported") ||
    message.includes("tx already exists")
  );
}

function normalizeAddress(
  value: string | null | undefined,
  failureCode: string,
  failureReason: string
): string {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    throw new ManagedExecutionIntentError({
      failureCode,
      failureReason
    });
  }

  if (!ethers.utils.isAddress(normalizedValue)) {
    throw new ManagedExecutionIntentError({
      failureCode,
      failureReason
    });
  }

  return ethers.utils.getAddress(normalizedValue);
}

function buildTransferPlan(
  intent: WorkerIntentProjection
): PolicyControlledWithdrawalTransferPlan {
  const walletAddress = normalizeAddress(
    intent.sourceWalletAddress,
    "missing_withdrawal_source_wallet",
    "Withdrawal intent is missing a source wallet address."
  );
  const destinationAddress = normalizeAddress(
    intent.externalAddress,
    "missing_withdrawal_destination_address",
    "Withdrawal intent is missing an external destination address."
  );

  if (intent.asset.chainId !== intent.chainId) {
    throw new ManagedExecutionIntentError({
      failureCode: "withdrawal_asset_chain_mismatch",
      failureReason:
        "Withdrawal intent asset chain does not match the intent chain.",
      fromAddress: walletAddress,
      toAddress: destinationAddress
    });
  }

  let amount: ethers.BigNumber;

  try {
    amount = parseAssetAmount(intent.requestedAmount, intent.asset.decimals);
  } catch {
    throw new ManagedExecutionIntentError({
      failureCode: "invalid_withdrawal_requested_amount",
      failureReason:
        "Withdrawal intent amount is invalid for the configured asset decimals.",
      fromAddress: walletAddress,
      toAddress: destinationAddress
    });
  }

  if (intent.asset.assetType === "native") {
    return {
      walletAddress,
      destinationAddress,
      assetAddress: ethers.constants.AddressZero,
      amount
    };
  }

  if (intent.asset.assetType === "erc20") {
    return {
      walletAddress,
      destinationAddress,
      assetAddress: normalizeAddress(
        intent.asset.contractAddress,
        "missing_withdrawal_asset_contract_address",
        "Withdrawal intent asset is ERC-20 but the contract address is missing."
      ),
      amount
    };
  }

  throw new ManagedExecutionIntentError({
    failureCode: "unsupported_withdrawal_asset_type",
    failureReason: `Withdrawal intent asset type '${intent.asset.assetType}' is not supported by the policy-controlled withdrawal broadcaster.`,
    fromAddress: walletAddress,
    toAddress: destinationAddress
  });
}

export function createPolicyControlledWithdrawalBroadcaster(
  runtime: WorkerRuntime
): PolicyControlledWithdrawalBroadcaster | null {
  if (runtime.executionMode !== "managed") {
    return null;
  }

  if (
    !runtime.rpcUrl ||
    !runtime.policyControlledWithdrawalExecutorPrivateKey ||
    !runtime.policyControlledWithdrawalPolicySignerPrivateKey
  ) {
    return null;
  }

  const provider = createJsonRpcProvider(runtime.rpcUrl);
  const executor = new ethers.Wallet(
    runtime.policyControlledWithdrawalExecutorPrivateKey,
    provider
  );
  const policySigner = new ethers.Wallet(
    runtime.policyControlledWithdrawalPolicySignerPrivateKey
  );

  return {
    async prepare(intent: WorkerIntentProjection) {
      const plan = buildTransferPlan(intent);
      const walletContract = createPolicyControlledWalletReadContract(
        plan.walletAddress,
        provider
      );
      const [policySignerAddress, authorizedExecutorAddress, authorizationNonce] =
        await Promise.all([
          walletContract.policySigner(),
          walletContract.authorizedExecutor(),
          walletContract.nextNonce()
        ]);

      if (
        ethers.utils.getAddress(policySignerAddress) !==
        ethers.utils.getAddress(policySigner.address)
      ) {
        throw new ManagedExecutionIntentError({
          failureCode: "policy_controlled_wallet_policy_signer_mismatch",
          failureReason:
            "Withdrawal source wallet is configured with a different policy signer than the worker runtime.",
          fromAddress: plan.walletAddress,
          toAddress: plan.destinationAddress
        });
      }

      if (
        ethers.utils.getAddress(authorizedExecutorAddress) !==
        ethers.utils.getAddress(executor.address)
      ) {
        throw new ManagedExecutionIntentError({
          failureCode: "policy_controlled_wallet_executor_mismatch",
          failureReason:
            "Withdrawal source wallet is configured with a different authorized executor than the worker runtime.",
          fromAddress: plan.walletAddress,
          toAddress: plan.destinationAddress
        });
      }

      const latestBlock = await provider.getBlock("latest");
      const authorizationDeadline =
        latestBlock.timestamp +
        runtime.policyControlledWithdrawalAuthorizationTtlSeconds;
      const authorizationSignature =
        await signPolicyControlledWithdrawalAuthorization({
          walletAddress: plan.walletAddress,
          chainId: intent.chainId,
          policySigner,
          intentId: intent.id,
          assetAddress: plan.assetAddress,
          destinationAddress: plan.destinationAddress,
          amount: plan.amount,
          authorizationNonce,
          authorizationDeadline
        });
      const contract = createPolicyControlledWalletWriteContract(
        plan.walletAddress,
        executor
      );
      const nonce = await executor.getTransactionCount("pending");
      const unsignedTransaction = await executor.populateTransaction({
        ...(await contract.populateTransaction.executeAuthorizedTransfer(
          hashPolicyControlledIntentId(intent.id),
          plan.assetAddress,
          plan.destinationAddress,
          plan.amount,
          authorizationNonce,
          authorizationDeadline,
          authorizationSignature
        )),
        nonce,
        chainId: intent.chainId
      });
      const serializedTransaction = await executor.signTransaction(
        unsignedTransaction
      );
      const parsedTransaction =
        ethers.utils.parseTransaction(serializedTransaction);

      if (!parsedTransaction.hash) {
        throw new Error(
          "Signed policy-controlled withdrawal transaction did not produce a transaction hash."
        );
      }

      return {
        txHash: parsedTransaction.hash,
        nonce,
        serializedTransaction,
        fromAddress: executor.address,
        toAddress: plan.walletAddress
      };
    },

    async broadcastSignedTransaction(
      signedTransaction: string
    ): Promise<DepositBroadcastResult> {
      const parsedTransaction =
        ethers.utils.parseTransaction(signedTransaction);

      if (!parsedTransaction.hash) {
        throw new Error(
          "Signed policy-controlled withdrawal transaction did not produce a transaction hash."
        );
      }

      try {
        const response = await provider.sendTransaction(signedTransaction);

        return {
          txHash: response.hash,
          fromAddress: parsedTransaction.from ?? "",
          toAddress: parsedTransaction.to ?? ""
        };
      } catch (error) {
        if (isAlreadyKnownBroadcastError(error)) {
          return {
            txHash: parsedTransaction.hash,
            fromAddress: parsedTransaction.from ?? "",
            toAddress: parsedTransaction.to ?? ""
          };
        }

        throw new Error(describeBroadcastError(error));
      }
    }
  };
}
