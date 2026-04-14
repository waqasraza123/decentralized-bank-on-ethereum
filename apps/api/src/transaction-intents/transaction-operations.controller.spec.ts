jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  }),
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { TransactionOperationsController } from "./transaction-operations.controller";
import { TransactionOperationsService } from "./transaction-operations.service";

describe("TransactionOperationsController", () => {
  let app: INestApplication;
  const transactionOperationsService = {
    searchTransactionOperations: jest.fn(),
    getCustomerOperationsSnapshot: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionOperationsController],
      providers: [
        InternalOperatorApiKeyGuard,
        {
          provide: TransactionOperationsService,
          useValue: transactionOperationsService
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects malformed transaction operation filters", async () => {
    await request(app.getHttpServer())
      .get("/transaction-intents/internal/operations/search")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        assetSymbol: "E",
        email: "invalid-email",
        txHash: "0x1234"
      })
      .expect(400);

    expect(
      transactionOperationsService.searchTransactionOperations
    ).not.toHaveBeenCalled();
  });

  it("passes governed transaction operation filters through", async () => {
    transactionOperationsService.searchTransactionOperations.mockResolvedValue({
      intents: [],
      limit: 20
    });

    const response = await request(app.getHttpServer())
      .get("/transaction-intents/internal/operations/search")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "20",
        intentType: "withdrawal",
        status: "settled",
        assetSymbol: "USDC",
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        idempotencyKey: "intent_key_123"
      })
      .expect(200);

    expect(
      transactionOperationsService.searchTransactionOperations
    ).toHaveBeenCalledWith({
      limit: 20,
      intentType: "withdrawal",
      status: "settled",
      assetSymbol: "USDC",
      customerAccountId: "account_1",
      supabaseUserId: "supabase_1",
      email: "user@example.com",
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      idempotencyKey: "intent_key_123"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Transaction operations retrieved successfully.",
      data: {
        intents: [],
        limit: 20
      }
    });
  });

  it("rejects malformed customer operations snapshot filters", async () => {
    await request(app.getHttpServer())
      .get("/transaction-intents/internal/operations/customer-snapshot")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "a".repeat(201)
      })
      .expect(400);

    expect(
      transactionOperationsService.getCustomerOperationsSnapshot
    ).not.toHaveBeenCalled();
  });

  it("passes governed customer operations snapshot filters through", async () => {
    transactionOperationsService.getCustomerOperationsSnapshot.mockResolvedValue({
      customer: {
        customerId: "customer_1"
      },
      recentLimit: 10
    });

    const response = await request(app.getHttpServer())
      .get("/transaction-intents/internal/operations/customer-snapshot")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        recentLimit: "10"
      })
      .expect(200);

    expect(
      transactionOperationsService.getCustomerOperationsSnapshot
    ).toHaveBeenCalledWith({
      customerAccountId: "account_1",
      supabaseUserId: "supabase_1",
      recentLimit: 10
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Customer operations snapshot retrieved successfully.",
      data: {
        customer: {
          customerId: "customer_1"
        },
        recentLimit: 10
      }
    });
  });
});
