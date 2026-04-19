import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ClientObservabilityController } from "./client-observability.controller";
import { ClientObservabilityService } from "./client-observability.service";

describe("ClientObservabilityController", () => {
  let app: INestApplication;
  const clientObservabilityService = {
    recordTelemetry: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientObservabilityController],
      providers: [
        {
          provide: ClientObservabilityService,
          useValue: clientObservabilityService
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects malformed client telemetry payloads", async () => {
    await request(app.getHttpServer())
      .post("/client-observability/events")
      .send({
        app: "customer-web",
        environment: "production",
        sessionId: "sess_1",
        timestamp: "not-a-date",
        kind: "bad_kind",
        level: "error",
        message: "broken"
      })
      .expect(400);

    expect(clientObservabilityService.recordTelemetry).not.toHaveBeenCalled();
  });

  it("records validated telemetry payloads", async () => {
    clientObservabilityService.recordTelemetry.mockResolvedValue({
      auditEventId: "audit_1",
      platformAlertId: "alert_1"
    });

    const response = await request(app.getHttpServer())
      .post("/client-observability/events")
      .set("x-request-id", "req_1")
      .set("origin", "https://app.example.com")
      .set("referer", "https://app.example.com/wallet")
      .set("user-agent", "Mozilla/5.0")
      .send({
        app: "customer-web",
        environment: "production",
        release: "2026.04.19",
        sessionId: "sess_1",
        timestamp: "2026-04-19T12:00:00.000Z",
        kind: "exception",
        level: "error",
        message: "Runtime crashed",
        errorName: "TypeError"
      })
      .expect(202);

    expect(clientObservabilityService.recordTelemetry).toHaveBeenCalledWith(
      {
        app: "customer-web",
        environment: "production",
        release: "2026.04.19",
        sessionId: "sess_1",
        timestamp: "2026-04-19T12:00:00.000Z",
        kind: "exception",
        level: "error",
        message: "Runtime crashed",
        errorName: "TypeError"
      },
      expect.objectContaining({
        requestId: "req_1",
        origin: "https://app.example.com",
        referer: "https://app.example.com/wallet",
        userAgent: "Mozilla/5.0"
      })
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Client telemetry recorded successfully.",
      data: {
        auditEventId: "audit_1",
        platformAlertId: "alert_1"
      }
    });
  });
});
