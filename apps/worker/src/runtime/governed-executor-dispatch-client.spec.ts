import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import {
  createGovernedExecutorDispatchClient,
  GovernedExecutorDispatchError
} from "./governed-executor-dispatch-client";

const runtime = {
  environment: "production" as const,
  workerId: "worker-1",
  internalApiBaseUrl: "http://localhost:3000",
  internalWorkerApiKey: "worker-key",
  executionMode: "monitor" as const,
  pollIntervalMs: 10,
  batchLimit: 20,
  requestTimeoutMs: 250,
  internalApiStartupGracePeriodMs: 45000,
  confirmationBlocks: 1,
  reconciliationScanIntervalMs: 300000,
  solvencySnapshotIntervalMs: 300000,
  governedExecutionDispatchIntervalMs: 60000,
  platformAlertReEscalationIntervalMs: 300000,
  governedExecutorDispatchBaseUrl: "https://executor.example.com",
  governedExecutorDispatchApiKey: "dispatch-key",
  governedExecutorDispatchTimeoutMs: 500,
  rpcUrl: null,
  depositSignerPrivateKey: null,
  managedWithdrawalClaimTimeoutMs: 60000,
  policyControlledWithdrawalExecutorPrivateKey: null,
  policyControlledWithdrawalPolicySignerPrivateKey: null,
  policyControlledWithdrawalAuthorizationTtlSeconds: 300,
  solvencyAnchorContractAddress: null,
  solvencyAnchorSignerPrivateKey: null,
  managedWithdrawalSigners: []
};

test("governed executor dispatch client posts signed execution packages", async () => {
  const originalCreate = axios.create;
  const calls: Array<{ url: string; payload: unknown }> = [];
  const fakeHttpClient = {
    post(url: string, payload: unknown) {
      calls.push({ url, payload });
      return Promise.resolve({
        status: 202,
        data: {
          accepted: true,
          backendReference: "executor-job-1"
        }
      });
    }
  };

  axios.create = (() => fakeHttpClient as never) as unknown as typeof axios.create;

  try {
    const client = createGovernedExecutorDispatchClient(runtime);
    assert.ok(client);

    const result = await client.deliverExecutionRequest({
      dispatchReference: "dispatch:request_1",
      request: {
        id: "request_1",
        environment: "production",
        chainId: 8453,
        executionType: "loan_contract_creation",
        status: "pending_execution",
        targetType: "LoanAgreement",
        targetId: "loan_1",
        loanAgreementId: "loan_1",
        stakingPoolGovernanceRequestId: null,
        contractAddress: "0x0000000000000000000000000000000000000def",
        contractMethod: "createLoan",
        walletAddress: "0x0000000000000000000000000000000000000abc",
        requestNote: null,
        requestedByActorType: "operator",
        requestedByActorId: "op_1",
        requestedByActorRole: "risk_manager",
        requestedAt: new Date().toISOString(),
        executedByActorType: null,
        executedByActorId: null,
        executedByActorRole: null,
        executedAt: null,
        blockchainTransactionHash: null,
        externalExecutionReference: null,
        failureReason: null,
        failedAt: null,
        metadata: null,
        executionPayload: { principalAmount: "1000" },
        executionResult: null,
        canonicalExecutionPayload: { principalAmount: "1000" },
        canonicalExecutionPayloadText: '{"principalAmount":"1000"}',
        executionPackageHash: "0xpackage",
        executionPackageChecksumSha256: "checksum",
        executionPackageSignature: "0xsig",
        executionPackageSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1",
        executionPackageSignerAddress: "0x0000000000000000000000000000000000000aaa",
        executionPackagePublishedAt: new Date().toISOString(),
        claimedByWorkerId: null,
        claimedAt: null,
        claimExpiresAt: null,
        dispatchStatus: "dispatched",
        dispatchPreparedAt: new Date().toISOString(),
        dispatchedByWorkerId: "worker-1",
        dispatchReference: "dispatch:request_1",
        dispatchVerificationChecksumSha256: "checksum",
        dispatchFailureReason: null,
        deliveryStatus: "not_delivered",
        deliveryAttemptedAt: null,
        deliveryAcceptedAt: null,
        deliveredByWorkerId: null,
        deliveryBackendType: null,
        deliveryBackendReference: null,
        deliveryHttpStatus: null,
        deliveryFailureReason: null,
        expectedExecutionCalldataHash: "0xcalldatahash",
        expectedExecutionMethodSelector: "0x12345678",
        updatedAt: new Date().toISOString()
      }
    });

    assert.equal(result.backendReference, "executor-job-1");
    assert.equal(result.httpStatus, 202);
    assert.equal(calls[0]?.url, "/governed-execution/dispatches");
  } finally {
    axios.create = originalCreate;
  }
});

test("governed executor dispatch client surfaces backend rejection as a typed error", async () => {
  const originalCreate = axios.create;
  const fakeHttpClient = {
    post() {
      return Promise.reject({
        isAxiosError: true,
        response: {
          status: 503,
          data: {
            message: "executor unavailable",
            backendReference: "executor-job-2"
          }
        },
        message: "Request failed"
      });
    }
  };

  axios.create = (() => fakeHttpClient as never) as unknown as typeof axios.create;

  try {
    const client = createGovernedExecutorDispatchClient(runtime);
    assert.ok(client);

    await assert.rejects(
      () =>
        client.deliverExecutionRequest({
          dispatchReference: "dispatch:request_2",
          request: {
            id: "request_2",
            environment: "production",
            chainId: 8453,
            executionType: "staking_pool_creation",
            status: "pending_execution",
            targetType: "StakingPoolGovernanceRequest",
            targetId: "staking_1",
            loanAgreementId: null,
            stakingPoolGovernanceRequestId: "staking_1",
            contractAddress: "0x0000000000000000000000000000000000000def",
            contractMethod: "createPool",
            walletAddress: null,
            requestNote: null,
            requestedByActorType: "operator",
            requestedByActorId: "op_1",
            requestedByActorRole: "risk_manager",
            requestedAt: new Date().toISOString(),
            executedByActorType: null,
            executedByActorId: null,
            executedByActorRole: null,
            executedAt: null,
            blockchainTransactionHash: null,
            externalExecutionReference: null,
            failureReason: null,
            failedAt: null,
            metadata: null,
            executionPayload: { stakingPoolId: 1, rewardRate: 12 },
            executionResult: null,
            canonicalExecutionPayload: null,
            canonicalExecutionPayloadText: "{}",
            executionPackageHash: "0xpackage",
            executionPackageChecksumSha256: "checksum",
            executionPackageSignature: "0xsig",
            executionPackageSignatureAlgorithm:
              "ethereum-secp256k1-keccak256-v1",
            executionPackageSignerAddress:
              "0x0000000000000000000000000000000000000aaa",
            executionPackagePublishedAt: new Date().toISOString(),
            claimedByWorkerId: null,
            claimedAt: null,
            claimExpiresAt: null,
            dispatchStatus: "dispatched",
            dispatchPreparedAt: new Date().toISOString(),
            dispatchedByWorkerId: "worker-1",
            dispatchReference: "dispatch:request_2",
            dispatchVerificationChecksumSha256: "checksum",
            dispatchFailureReason: null,
            deliveryStatus: "not_delivered",
            deliveryAttemptedAt: null,
            deliveryAcceptedAt: null,
            deliveredByWorkerId: null,
            deliveryBackendType: null,
            deliveryBackendReference: null,
            deliveryHttpStatus: null,
            deliveryFailureReason: null,
            expectedExecutionCalldataHash: null,
            expectedExecutionMethodSelector: null,
            updatedAt: new Date().toISOString()
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof GovernedExecutorDispatchError);
        assert.equal(error.httpStatus, 503);
        assert.equal(error.backendReference, "executor-job-2");
        return true;
      }
    );
  } finally {
    axios.create = originalCreate;
  }
});
