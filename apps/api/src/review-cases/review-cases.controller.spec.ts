jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { ReviewCasesController } from "./review-cases.controller";
import { ReviewCasesService } from "./review-cases.service";

describe("ReviewCasesController", () => {
  let app: INestApplication;
  const reviewCasesService = {
    listReviewCases: jest.fn(),
    addReviewCaseNote: jest.fn(),
    applyManualResolution: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReviewCasesController],
      providers: [
        InternalOperatorApiKeyGuard,
        {
          provide: ReviewCasesService,
          useValue: reviewCasesService
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

  it("rejects missing operator authentication headers before reaching review-case mutations", async () => {
    await request(app.getHttpServer())
      .post("/review-cases/internal/review_case_1/notes")
      .send({
        note: "Investigating the case."
      })
      .expect(401);

    expect(reviewCasesService.addReviewCaseNote).not.toHaveBeenCalled();
  });

  it("rejects governed review-case note payloads that exceed the limit", async () => {
    await request(app.getHttpServer())
      .post("/review-cases/internal/review_case_1/notes")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        note: "x".repeat(2_001)
      })
      .expect(400);

    expect(reviewCasesService.addReviewCaseNote).not.toHaveBeenCalled();
  });

  it("rejects malformed review-case list filters", async () => {
    await request(app.getHttpServer())
      .get("/review-cases/internal")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "a".repeat(201),
        reasonCode: "Policy Denied",
        email: "invalid-email"
      })
      .expect(400);

    expect(reviewCasesService.listReviewCases).not.toHaveBeenCalled();
  });

  it("rejects malformed manual resolution payloads", async () => {
    await request(app.getHttpServer())
      .post("/review-cases/internal/review_case_1/apply-manual-resolution")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        manualResolutionReasonCode: "Support Case Closed",
        note: "x".repeat(2_001),
        unexpected: true
      })
      .expect(400);

    expect(reviewCasesService.applyManualResolution).not.toHaveBeenCalled();
  });

  it("passes governed review-case list filters through", async () => {
    reviewCasesService.listReviewCases.mockResolvedValue({
      reviewCases: [],
      limit: 10
    });

    const response = await request(app.getHttpServer())
      .get("/review-cases/internal")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "10",
        status: "open",
        type: "withdrawal_review",
        customerAccountId: "account_1",
        transactionIntentId: "intent_1",
        reasonCode: "policy_denied",
        assignedOperatorId: "ops_1",
        email: "user@example.com",
        supabaseUserId: "supabase_1"
      })
      .expect(200);

    expect(reviewCasesService.listReviewCases).toHaveBeenCalledWith({
      limit: 10,
      status: "open",
      type: "withdrawal_review",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      reasonCode: "policy_denied",
      assignedOperatorId: "ops_1",
      email: "user@example.com",
      supabaseUserId: "supabase_1"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Review cases retrieved successfully.",
      data: {
        reviewCases: [],
        limit: 10
      }
    });
  });

  it("passes the normalized operator identity and role through to manual resolution", async () => {
    reviewCasesService.applyManualResolution.mockResolvedValue({
      stateReused: false,
      reviewCase: {
        id: "review_case_1",
        status: "resolved"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/review-cases/internal/review_case_1/apply-manual-resolution")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "Senior_Operator")
      .send({
        manualResolutionReasonCode: "support_case_closed",
        note: "Handled through approved off-platform recovery."
      })
      .expect(201);

    expect(reviewCasesService.applyManualResolution).toHaveBeenCalledWith(
      "review_case_1",
      "ops_1",
      "senior_operator",
      {
        manualResolutionReasonCode: "support_case_closed",
        note: "Handled through approved off-platform recovery."
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Manual resolution applied successfully.",
      data: {
        stateReused: false,
        reviewCase: {
          id: "review_case_1",
          status: "resolved"
        }
      }
    });
  });
});
