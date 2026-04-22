import {
  INestApplication,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { BalanceTransfersInternalController } from "./balance-transfers-internal.controller";
import { BalanceTransfersService } from "./balance-transfers.service";

describe("BalanceTransfersInternalController", () => {
  let app: INestApplication;
  const balanceTransfersService = {
    listPendingBalanceTransfers: jest.fn(),
    decideBalanceTransfer: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BalanceTransfersInternalController],
      providers: [
        InternalOperatorBearerGuard,
        {
          provide: BalanceTransfersService,
          useValue: balanceTransfersService,
        },
      ],
    })
      .overrideGuard(InternalOperatorBearerGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): Record<string, unknown> };
        }) => {
          const request = context.switchToHttp().getRequest() as {
            headers: Record<string, string | string[] | undefined>;
            internalOperator?: {
              operatorId: string;
              operatorRole?: string;
            };
          };
          const authorization = request.headers.authorization;

          if (authorization !== "Bearer test-operator-token") {
            throw new UnauthorizedException(
              "Operator authentication requires a bearer token."
            );
          }

          request.internalOperator = {
            operatorId: "ops_1",
            operatorRole:
              typeof request.headers["x-operator-role"] === "string"
                ? request.headers["x-operator-role"].toLowerCase()
                : undefined,
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
  });

  it("rejects missing operator authentication before reaching the pending list handler", async () => {
    await request(app.getHttpServer())
      .get("/balance-transfers/internal/pending")
      .expect(401);

    expect(balanceTransfersService.listPendingBalanceTransfers).not.toHaveBeenCalled();
  });

  it("passes pending transfer filters through to the service", async () => {
    balanceTransfersService.listPendingBalanceTransfers.mockResolvedValue({
      intents: [],
      limit: 10,
    });

    const response = await request(app.getHttpServer())
      .get("/balance-transfers/internal/pending")
      .set("Authorization", "Bearer test-operator-token")
      .query({
        limit: "10",
      })
      .expect(200);

    expect(balanceTransfersService.listPendingBalanceTransfers).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Pending internal balance transfers retrieved successfully.",
      data: {
        intents: [],
        limit: 10,
      },
    });
  });

  it("rejects malformed operator decision payloads", async () => {
    await request(app.getHttpServer())
      .post("/balance-transfers/internal/intent_1/decision")
      .set("Authorization", "Bearer test-operator-token")
      .send({
        decision: "approved",
        unexpected: true,
      })
      .expect(400);

    expect(balanceTransfersService.decideBalanceTransfer).not.toHaveBeenCalled();
  });

  it("passes the normalized operator identity and denial payload through to the service", async () => {
    balanceTransfersService.decideBalanceTransfer.mockResolvedValue({
      decisionReused: false,
      intent: {
        id: "intent_internal_1",
        status: "cancelled",
        policyDecision: "denied",
      },
    });

    const response = await request(app.getHttpServer())
      .post("/balance-transfers/internal/intent_internal_1/decision")
      .set("Authorization", "Bearer test-operator-token")
      .set("x-operator-role", "Risk_Manager")
      .send({
        decision: "denied",
        note: "Denied after review.",
        denialReason: "Recipient mismatch",
      })
      .expect(201);

    expect(balanceTransfersService.decideBalanceTransfer).toHaveBeenCalledWith(
      "intent_internal_1",
      "ops_1",
      {
        decision: "denied",
        note: "Denied after review.",
        denialReason: "Recipient mismatch",
      },
      "risk_manager"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Internal balance transfer denied successfully.",
      data: {
        decisionReused: false,
        intent: {
          id: "intent_internal_1",
          status: "cancelled",
          policyDecision: "denied",
        },
      },
    });
  });
});
