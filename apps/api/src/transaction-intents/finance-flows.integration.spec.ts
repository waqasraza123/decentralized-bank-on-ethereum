jest.mock("@stealth-trails-bank/config/api", () => ({
  loadDepositRiskPolicyRuntimeConfig: () => ({
    autoApproveThresholds: []
  }),
  loadInternalWorkerRuntimeConfig: () => ({
    internalWorkerApiKey: "test-worker-key"
  }),
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadSensitiveOperatorActionPolicyRuntimeConfig: () => ({
    transactionIntentDecisionAllowedOperatorRoles: [
      "operations_admin",
      "risk_manager"
    ],
    custodyOperationAllowedOperatorRoles: [
      "operations_admin",
      "senior_operator",
      "treasury"
    ],
    stakingGovernanceAllowedOperatorRoles: [
      "treasury",
      "risk_manager",
      "compliance_lead"
    ]
  })
}));

import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { utils as ethersUtils } from "ethers";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { OperatorIdentityService } from "../auth/operator-identity.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { FinanceFlowIntegrationHarness } from "../test-utils/finance-flow-integration-harness";
import { createIntegrationTestApp } from "../test-utils/create-integration-test-app";
import { TransactionIntentsInternalController } from "./transaction-intents-internal.controller";
import { TransactionIntentsController } from "./transaction-intents.controller";
import { TransactionIntentsService } from "./transaction-intents.service";
import { TransactionIntentsWorkerController } from "./transaction-intents-worker.controller";
import { WithdrawalIntentsInternalController } from "./withdrawal-intents-internal.controller";
import { WithdrawalIntentsController } from "./withdrawal-intents.controller";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";
import { WithdrawalIntentsWorkerController } from "./withdrawal-intents-worker.controller";

describe("Finance flows integration", () => {
  let app: INestApplication;
  let harness: FinanceFlowIntegrationHarness;

  const operatorHeaders = {
    Authorization: "Bearer ops-admin-token"
  };
  const workerHeaders = {
    "x-worker-api-key": "test-worker-key",
    "x-worker-id": "worker_1"
  };
  const authHeaders = {
    Authorization: "Bearer test-token"
  };
  const operatorIdentityService = {
    resolveFromBearerToken: jest.fn(
      async ({
        headers
      }: {
        headers: Record<string, string | string[] | undefined>;
      }) => {
        if (headers.authorization !== "Bearer ops-admin-token") {
          return null;
        }

        return {
          operatorDbId: null,
          operatorId: "ops_1",
          operatorRole: "operations_admin",
          operatorRoles: ["operations_admin"],
          operatorSupabaseUserId: null,
          operatorEmail: null,
          authSource: "supabase_jwt" as const,
          environment: "development",
          sessionCorrelationId: null
        };
      }
    ),
    resolveFromLegacyApiKey: jest.fn(async () => null)
  };

  beforeEach(async () => {
    harness = new FinanceFlowIntegrationHarness();

    const integrationApp = await createIntegrationTestApp({
      controllers: [
        TransactionIntentsController,
        TransactionIntentsInternalController,
        TransactionIntentsWorkerController,
        WithdrawalIntentsController,
        WithdrawalIntentsInternalController,
        WithdrawalIntentsWorkerController
      ],
      providers: [
        TransactionIntentsService,
        WithdrawalIntentsService,
        JwtAuthGuard,
        InternalOperatorBearerGuard,
        InternalWorkerApiKeyGuard,
        {
          provide: AuthService,
          useValue: harness.authService
        },
        {
          provide: PrismaService,
          useValue: harness.prismaService
        },
        {
          provide: OperatorIdentityService,
          useValue: operatorIdentityService
        },
        {
          provide: LedgerService,
          useValue: harness.ledgerService
        },
        {
          provide: ReviewCasesService,
          useValue: {
            openOrReuseReviewCase: jest.fn().mockResolvedValue({
              reviewCase: {
                id: "review_case_1"
              },
              reviewCaseReused: false
            })
          }
        }
      ]
    });

    app = integrationApp.app;
  });

  afterEach(async () => {
    await app.close();
  });

  it("proves a full deposit lifecycle across customer, operator, and worker APIs", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/transaction-intents/deposit-requests")
      .set(authHeaders)
      .send({
        idempotencyKey: "deposit-flow-001",
        assetSymbol: "usdc",
        amount: "125.50"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.idempotencyReused).toBe(false);
    expect(createResponse.body.data.intent.status).toBe("review_required");
    expect(createResponse.body.data.intent.policyDecision).toBe(
      "review_required"
    );
    expect(createResponse.body.data.intent.destinationWalletAddress).toBe(
      harness.wallet.address
    );

    const intentId = createResponse.body.data.intent.id as string;
    const txHash = `0x${"1".repeat(64)}`;

    const pendingResponse = await request(app.getHttpServer())
      .get("/transaction-intents/internal/deposit-requests/pending?limit=10")
      .set(operatorHeaders);

    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.data.intents).toHaveLength(1);
    expect(pendingResponse.body.data.intents[0].id).toBe(intentId);
    expect(pendingResponse.body.data.intents[0].customer.email).toBe(
      harness.customer.email
    );

    const approvalResponse = await request(app.getHttpServer())
      .post(`/transaction-intents/internal/deposit-requests/${intentId}/decision`)
      .set(operatorHeaders)
      .send({
        decision: "approved",
        note: "Operations review passed."
      });

    expect(approvalResponse.status).toBe(201);
    expect(approvalResponse.body.data.decision).toBe("approved");
    expect(approvalResponse.body.data.intent.status).toBe("approved");

    const queueResponse = await request(app.getHttpServer())
      .post(`/transaction-intents/internal/deposit-requests/${intentId}/queue`)
      .set(operatorHeaders)
      .send({
        note: "Queued for worker."
      });

    expect(queueResponse.status).toBe(201);
    expect(queueResponse.body.data.queueReused).toBe(false);
    expect(queueResponse.body.data.intent.status).toBe("queued");

    const queuedResponse = await request(app.getHttpServer())
      .get("/transaction-intents/internal/worker/deposit-requests/queued?limit=10")
      .set(workerHeaders);

    expect(queuedResponse.status).toBe(200);
    expect(queuedResponse.body.data.intents).toHaveLength(1);
    expect(queuedResponse.body.data.intents[0].asset.assetType).toBe("erc20");
    expect(queuedResponse.body.data.intents[0].asset.contractAddress).toBe(
      harness.asset.contractAddress
    );

    const broadcastResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/deposit-requests/${intentId}/broadcast`
      )
      .set(workerHeaders)
      .send({
        txHash,
        fromAddress: "0x0000000000000000000000000000000000000fed",
        toAddress: harness.wallet.address
      });

    expect(broadcastResponse.status).toBe(201);
    expect(broadcastResponse.body.data.broadcastReused).toBe(false);
    expect(broadcastResponse.body.data.intent.status).toBe("broadcast");
    expect(
      broadcastResponse.body.data.intent.latestBlockchainTransaction.txHash
    ).toBe(txHash);

    const confirmResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/deposit-requests/${intentId}/confirm`
      )
      .set(workerHeaders)
      .send({
        txHash
      });

    expect(confirmResponse.status).toBe(201);
    expect(confirmResponse.body.data.confirmReused).toBe(false);
    expect(confirmResponse.body.data.intent.status).toBe("confirmed");
    expect(
      confirmResponse.body.data.intent.latestBlockchainTransaction.status
    ).toBe("confirmed");

    const settleResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/deposit-requests/${intentId}/settle`
      )
      .set(workerHeaders)
      .send({
        note: "Settled into customer balance."
      });

    expect(settleResponse.status).toBe(201);
    expect(settleResponse.body.data.settlementReused).toBe(false);
    expect(settleResponse.body.data.intent.status).toBe("settled");
    expect(settleResponse.body.data.intent.settledAmount).toBe("125.5");

    const customerViewResponse = await request(app.getHttpServer())
      .get("/transaction-intents/me?limit=10")
      .set(authHeaders);

    expect(customerViewResponse.status).toBe(200);
    expect(customerViewResponse.body.data.intents).toHaveLength(1);
    expect(customerViewResponse.body.data.intents[0]).toEqual(
      expect.objectContaining({
        id: intentId,
        intentType: "deposit",
        status: "settled",
        policyDecision: "approved",
        requestedAmount: "125.5",
        settledAmount: "125.5"
      })
    );

    expect(harness.hasLedgerJournalForIntent(intentId)).toBe(true);
    expect(harness.getBalanceSnapshot()).toEqual({
      available: "125.5",
      pending: "0"
    });
    expect(harness.getAuditActionsForIntent(intentId)).toEqual([
      "transaction_intent.deposit.requested",
      "transaction_intent.deposit.approved",
      "transaction_intent.deposit.queued",
      "transaction_intent.deposit.broadcast",
      "transaction_intent.deposit.confirmed",
      "transaction_intent.deposit.settled"
    ]);
  });

  it("rejects non-whitelisted fields on the deposit worker control-plane", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/transaction-intents/deposit-requests")
      .set(authHeaders)
      .send({
        idempotencyKey: "deposit-flow-validation-001",
        assetSymbol: "usdc",
        amount: "10"
      });

    expect(createResponse.status).toBe(201);

    const intentId = createResponse.body.data.intent.id as string;

    await request(app.getHttpServer())
      .post(`/transaction-intents/internal/deposit-requests/${intentId}/decision`)
      .set(operatorHeaders)
      .send({
        decision: "approved"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/transaction-intents/internal/deposit-requests/${intentId}/queue`)
      .set(operatorHeaders)
      .send({})
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/deposit-requests/${intentId}/broadcast`
      )
      .set(workerHeaders)
      .send({
        txHash: `0x${"9".repeat(64)}`,
        unexpectedField: "reject-me"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("property unexpectedField should not exist");
  });

  it("proves a full withdrawal lifecycle with reservation and settlement balance effects", async () => {
    harness.setAvailableBalance("500");

    const destinationAddress = "0x0000000000000000000000000000000000000def";
    const createResponse = await request(app.getHttpServer())
      .post("/transaction-intents/withdrawal-requests")
      .set(authHeaders)
      .send({
        idempotencyKey: "withdrawal-flow-001",
        assetSymbol: "usdc",
        amount: "125",
        destinationAddress
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.idempotencyReused).toBe(false);
    expect(createResponse.body.data.intent.status).toBe("requested");
    expect(createResponse.body.data.intent.sourceWalletAddress).toBe(
      harness.wallet.address
    );
    expect(createResponse.body.data.intent.externalAddress).toBe(
      ethersUtils.getAddress(destinationAddress)
    );
    expect(harness.getBalanceSnapshot()).toEqual({
      available: "375",
      pending: "125"
    });

    const intentId = createResponse.body.data.intent.id as string;
    const txHash = `0x${"2".repeat(64)}`;

    const pendingResponse = await request(app.getHttpServer())
      .get("/transaction-intents/internal/withdrawal-requests/pending?limit=10")
      .set(operatorHeaders);

    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.data.intents).toHaveLength(1);
    expect(pendingResponse.body.data.intents[0].id).toBe(intentId);

    const approvalResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/withdrawal-requests/${intentId}/decision`
      )
      .set(operatorHeaders)
      .send({
        decision: "approved",
        note: "Travel rule and risk checks passed."
      });

    expect(approvalResponse.status).toBe(201);
    expect(approvalResponse.body.data.intent.status).toBe("approved");

    const queueResponse = await request(app.getHttpServer())
      .post(`/transaction-intents/internal/withdrawal-requests/${intentId}/queue`)
      .set(operatorHeaders)
      .send({
        note: "Queued for custody execution."
      });

    expect(queueResponse.status).toBe(201);
    expect(queueResponse.body.data.intent.status).toBe("queued");

    const queuedResponse = await request(app.getHttpServer())
      .get(
        "/transaction-intents/internal/worker/withdrawal-requests/queued?limit=10"
      )
      .set(workerHeaders);

    expect(queuedResponse.status).toBe(200);
    expect(queuedResponse.body.data.intents).toHaveLength(1);
    expect(queuedResponse.body.data.intents[0].status).toBe("queued");
    expect(queuedResponse.body.data.intents[0].asset.assetType).toBe("erc20");
    expect(queuedResponse.body.data.intents[0].asset.contractAddress).toBe(
      harness.asset.contractAddress
    );

    const startExecutionResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/start-execution`
      )
      .set(workerHeaders)
      .send({
        reclaimStaleAfterMs: 60000
      });

    expect(startExecutionResponse.status).toBe(201);
    expect(startExecutionResponse.body.data.executionClaimed).toBe(true);
    expect(startExecutionResponse.body.data.intent.latestBlockchainTransaction.status).toBe(
      "created"
    );

    const signedResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/signed`
      )
      .set(workerHeaders)
      .send({
        txHash,
        nonce: 7,
        serializedTransaction: "0xdeadbeef",
        fromAddress: harness.wallet.address,
        toAddress: destinationAddress
      });

    expect(signedResponse.status).toBe(201);
    expect(signedResponse.body.data.signedStateReused).toBe(false);
    expect(signedResponse.body.data.intent.latestBlockchainTransaction.status).toBe(
      "signed"
    );
    expect(
      signedResponse.body.data.intent.latestBlockchainTransaction.serializedTransaction
    ).toBe("0xdeadbeef");

    const signedReplayResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/signed`
      )
      .set(workerHeaders)
      .send({
        txHash,
        nonce: 7,
        serializedTransaction: "0xdeadbeef",
        fromAddress: harness.wallet.address,
        toAddress: destinationAddress
      });

    expect(signedReplayResponse.status).toBe(201);
    expect(signedReplayResponse.body.data.signedStateReused).toBe(true);

    const broadcastResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/broadcast`
      )
      .set(workerHeaders)
      .send({
        txHash,
        fromAddress: harness.wallet.address,
        toAddress: destinationAddress
      });

    expect(broadcastResponse.status).toBe(201);
    expect(broadcastResponse.body.data.intent.status).toBe("broadcast");
    expect(
      broadcastResponse.body.data.intent.latestBlockchainTransaction.fromAddress
    ).toBe(ethersUtils.getAddress(harness.wallet.address));
    expect(
      broadcastResponse.body.data.intent.latestBlockchainTransaction.toAddress
    ).toBe(ethersUtils.getAddress(destinationAddress));

    const confirmResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/confirm`
      )
      .set(workerHeaders)
      .send({
        txHash
      });

    expect(confirmResponse.status).toBe(201);
    expect(confirmResponse.body.data.intent.status).toBe("confirmed");
    expect(
      confirmResponse.body.data.intent.latestBlockchainTransaction.status
    ).toBe("confirmed");

    const settleResponse = await request(app.getHttpServer())
      .post(
        `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/settle`
      )
      .set(workerHeaders)
      .send({
        note: "Settled after final confirmation."
      });

    expect(settleResponse.status).toBe(201);
    expect(settleResponse.body.data.intent.status).toBe("settled");
    expect(settleResponse.body.data.intent.settledAmount).toBe("125");

    const customerViewResponse = await request(app.getHttpServer())
      .get("/transaction-intents/me?limit=10")
      .set(authHeaders);

    expect(customerViewResponse.status).toBe(200);
    expect(customerViewResponse.body.data.intents).toHaveLength(1);
    expect(customerViewResponse.body.data.intents[0]).toEqual(
      expect.objectContaining({
        id: intentId,
        intentType: "withdrawal",
        status: "settled",
        policyDecision: "approved",
        requestedAmount: "125",
        settledAmount: "125"
      })
    );

    expect(harness.hasLedgerJournalForIntent(intentId)).toBe(true);
    expect(harness.getBalanceSnapshot()).toEqual({
      available: "375",
      pending: "0"
    });
    expect(harness.getAuditActionsForIntent(intentId)).toEqual([
      "transaction_intent.withdrawal.requested",
      "transaction_intent.withdrawal.approved",
      "transaction_intent.withdrawal.queued",
      "transaction_intent.withdrawal.execution_started",
      "transaction_intent.withdrawal.broadcast_persisted",
      "transaction_intent.withdrawal.broadcast",
      "transaction_intent.withdrawal.confirmed",
      "transaction_intent.withdrawal.settled"
    ]);
  });
});
