import {
  createErc20TransferContract,
  createJsonRpcProvider,
  parseAssetAmount
} from "@stealth-trails-bank/contracts-sdk";
import { ethers } from "ethers";
import { ManagedExecutionIntentError } from "./deposit-broadcaster";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  DepositBroadcastResult,
  ManagedWithdrawalBroadcaster,
  WorkerIntentProjection
} from "./worker-types";

type ManagedWithdrawalTransferPlan =
  | {
      kind: "native";
      amount: ethers.BigNumber;
      destinationAddress: string;
      txToAddress: string;
    }
  | {
      kind: "erc20";
      contractAddress: string;
      amount: ethers.BigNumber;
      destinationAddress: string;
      txToAddress: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function buildManagedWithdrawalTransferPlan(
  intent: WorkerIntentProjection
): ManagedWithdrawalTransferPlan {
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
      toAddress: destinationAddress
    });
  }

  if (intent.asset.assetType === "native") {
    return {
      kind: "native",
      amount,
      destinationAddress,
      txToAddress: destinationAddress
    };
  }

  if (intent.asset.assetType === "erc20") {
    const contractAddress = normalizeAddress(
      intent.asset.contractAddress,
      "missing_withdrawal_asset_contract_address",
      "Withdrawal intent asset is ERC-20 but the contract address is missing."
    );

    return {
      kind: "erc20",
      contractAddress,
      amount,
      destinationAddress,
      txToAddress: contractAddress
    };
  }

  throw new ManagedExecutionIntentError({
    failureCode: "unsupported_withdrawal_asset_type",
    failureReason: `Withdrawal intent asset type '${intent.asset.assetType}' is not supported by the managed worker broadcaster.`,
    toAddress: destinationAddress
  });
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

export function createManagedWithdrawalBroadcaster(
  runtime: WorkerRuntime
): ManagedWithdrawalBroadcaster {
  if (runtime.executionMode !== "managed") {
    throw new Error(
      "Managed withdrawal broadcaster can only be created when WORKER_EXECUTION_MODE=managed."
    );
  }

  if (!runtime.rpcUrl) {
    throw new Error("RPC_URL is required for managed withdrawal broadcasting.");
  }

  const provider = createJsonRpcProvider(runtime.rpcUrl);
  const signerByWalletAddress = new Map<string, ethers.Wallet>();

  for (const signerConfig of runtime.managedWithdrawalSigners) {
    const configuredWalletAddress = ethers.utils.getAddress(
      signerConfig.walletAddress
    );
    const signer = new ethers.Wallet(signerConfig.privateKey, provider);

    if (signer.address !== configuredWalletAddress) {
      throw new Error(
        `Managed withdrawal signer private key does not match wallet ${configuredWalletAddress}.`
      );
    }

    if (signerByWalletAddress.has(configuredWalletAddress)) {
      throw new Error(
        `Managed withdrawal signer wallet ${configuredWalletAddress} is configured more than once.`
      );
    }

    signerByWalletAddress.set(configuredWalletAddress, signer);
  }

  return {
    canManageWallet(walletAddress: string | null | undefined): boolean {
      if (!walletAddress?.trim()) {
        return false;
      }

      if (!ethers.utils.isAddress(walletAddress)) {
        return false;
      }

      return signerByWalletAddress.has(ethers.utils.getAddress(walletAddress));
    },

    async prepare(intent: WorkerIntentProjection) {
      const sourceWalletAddress = normalizeAddress(
        intent.sourceWalletAddress,
        "missing_withdrawal_source_wallet",
        "Withdrawal intent is missing a source wallet address."
      );
      const signer = signerByWalletAddress.get(sourceWalletAddress);

      if (!signer) {
        throw new ManagedExecutionIntentError({
          failureCode: "managed_withdrawal_signer_unavailable",
          failureReason:
            "Withdrawal intent source wallet does not have a configured managed signer.",
          fromAddress: sourceWalletAddress,
          toAddress: intent.externalAddress ?? undefined
        });
      }

      const plan = buildManagedWithdrawalTransferPlan(intent);
      const nonce = await signer.getTransactionCount("pending");
      const unsignedTransaction =
        plan.kind === "native"
          ? await signer.populateTransaction({
              to: plan.destinationAddress,
              value: plan.amount,
              nonce,
              chainId: intent.chainId
            })
          : await signer.populateTransaction({
              ...(await createErc20TransferContract(
                plan.contractAddress,
                signer
              ).populateTransaction.transfer(
                plan.destinationAddress,
                plan.amount
              )),
              nonce,
              chainId: intent.chainId
            });
      const serializedTransaction = await signer.signTransaction(
        unsignedTransaction
      );
      const parsedTransaction =
        ethers.utils.parseTransaction(serializedTransaction);

      if (!parsedTransaction.hash) {
        throw new Error(
          "Signed withdrawal transaction did not produce a transaction hash."
        );
      }

      return {
        txHash: parsedTransaction.hash,
        nonce,
        serializedTransaction,
        fromAddress: sourceWalletAddress,
        toAddress: plan.txToAddress
      };
    },

    async broadcastSignedTransaction(
      signedTransaction: string
    ): Promise<DepositBroadcastResult> {
      const parsedTransaction =
        ethers.utils.parseTransaction(signedTransaction);

      if (!parsedTransaction.hash) {
        throw new Error(
          "Signed withdrawal transaction did not produce a transaction hash."
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
