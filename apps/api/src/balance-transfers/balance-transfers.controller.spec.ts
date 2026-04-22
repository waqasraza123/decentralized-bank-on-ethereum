import {
  INestApplication,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BalanceTransfersController } from "./balance-transfers.controller";
import { BalanceTransfersService } from "./balance-transfers.service";

describe("BalanceTransfersController", () => {
  let app: INestApplication;
  const authService = {
    assertCustomerMoneyMovementEnabled: jest.fn(),
    assertCustomerStepUpFresh: jest.fn(),
  };
  const balanceTransfersService = {
    previewRecipient: jest.fn(),
    createBalanceTransfer: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BalanceTransfersController],
      providers: [
        JwtAuthGuard,
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: BalanceTransfersService,
          useValue: balanceTransfersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): Record<string, unknown> };
        }) => {
          const request = context.switchToHttp().getRequest() as {
            headers: Record<string, string | string[] | undefined>;
            user?: {
              id: string;
              sessionId?: string | null;
            };
          };
          const authorization = request.headers.authorization;

          if (authorization !== "Bearer test-token") {
            throw new UnauthorizedException(
              "Customer authentication requires a bearer token."
            );
          }

          request.user = {
            id: "supabase_1",
            sessionId: "session_current",
          };

          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authService.assertCustomerMoneyMovementEnabled.mockResolvedValue(undefined);
    authService.assertCustomerStepUpFresh.mockResolvedValue(undefined);
  });

  it("rejects malformed recipient preview payloads before reaching the services", async () => {
    await request(app.getHttpServer())
      .post("/balance-transfers/me/recipient-preview")
      .set("Authorization", "Bearer test-token")
      .send({
        email: "not-an-email",
        assetSymbol: "!",
        amount: "-5",
      })
      .expect(400);

    expect(authService.assertCustomerMoneyMovementEnabled).not.toHaveBeenCalled();
    expect(balanceTransfersService.previewRecipient).not.toHaveBeenCalled();
  });

  it("passes authenticated customer context through to recipient preview", async () => {
    balanceTransfersService.previewRecipient.mockResolvedValue({
      normalizedEmail: "recipient@example.com",
      available: true,
      maskedEmail: "r*******t@e****.com",
      maskedDisplay: "A*** R***",
      thresholdOutcome: "review_required",
    });

    const response = await request(app.getHttpServer())
      .post("/balance-transfers/me/recipient-preview")
      .set("Authorization", "Bearer test-token")
      .send({
        email: "recipient@example.com",
        assetSymbol: "USDC",
        amount: "25",
      })
      .expect(201);

    expect(authService.assertCustomerMoneyMovementEnabled).toHaveBeenCalledWith(
      "supabase_1",
      "session_current"
    );
    expect(balanceTransfersService.previewRecipient).toHaveBeenCalledWith(
      "supabase_1",
      {
        email: "recipient@example.com",
        assetSymbol: "USDC",
        amount: "25",
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Recipient preview resolved successfully.",
      data: {
        normalizedEmail: "recipient@example.com",
        available: true,
        maskedEmail: "r*******t@e****.com",
        maskedDisplay: "A*** R***",
        thresholdOutcome: "review_required",
      },
    });
  });

  it("rejects malformed balance transfer create payloads before reaching the services", async () => {
    await request(app.getHttpServer())
      .post("/balance-transfers/me")
      .set("Authorization", "Bearer test-token")
      .send({
        idempotencyKey: "bad key with spaces",
        assetSymbol: "!",
        amount: "0",
        recipientEmail: "not-an-email",
      })
      .expect(400);

    expect(authService.assertCustomerMoneyMovementEnabled).not.toHaveBeenCalled();
    expect(authService.assertCustomerStepUpFresh).not.toHaveBeenCalled();
    expect(balanceTransfersService.createBalanceTransfer).not.toHaveBeenCalled();
  });

  it("passes authenticated customer context through to balance transfer creation", async () => {
    balanceTransfersService.createBalanceTransfer.mockResolvedValue({
      idempotencyReused: false,
      thresholdOutcome: "review_required",
      intent: {
        id: "intent_internal_1",
        status: "review_required",
      },
    });

    const response = await request(app.getHttpServer())
      .post("/balance-transfers/me")
      .set("Authorization", "Bearer test-token")
      .send({
        idempotencyKey: "internal_transfer_req_001",
        assetSymbol: "USDC",
        amount: "25",
        recipientEmail: "recipient@example.com",
      })
      .expect(201);

    expect(authService.assertCustomerMoneyMovementEnabled).toHaveBeenCalledWith(
      "supabase_1",
      "session_current"
    );
    expect(authService.assertCustomerStepUpFresh).toHaveBeenCalledWith(
      "supabase_1",
      "session_current"
    );
    expect(balanceTransfersService.createBalanceTransfer).toHaveBeenCalledWith(
      "supabase_1",
      {
        idempotencyKey: "internal_transfer_req_001",
        assetSymbol: "USDC",
        amount: "25",
        recipientEmail: "recipient@example.com",
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Internal balance transfer created and queued for operator review.",
      data: {
        idempotencyReused: false,
        thresholdOutcome: "review_required",
        intent: {
          id: "intent_internal_1",
          status: "review_required",
        },
      },
    });
  });
});
