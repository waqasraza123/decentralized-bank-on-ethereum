import axios from "axios";
import {
  PlatformAlertCategory,
  PlatformAlertDeliveryStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAlertDeliveryService } from "./platform-alert-delivery.service";

jest.mock("axios");
jest.mock("@stealth-trails-bank/config/api", () => ({
  loadPlatformAlertDeliveryRuntimeConfig: () => ({
    requestTimeoutMs: 5000,
    targets: [
      {
        name: "ops-critical",
        url: "https://ops.example.com/hooks/platform-alerts",
        bearerToken: "secret-token",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "acknowledged", "routed_to_review_case"]
      }
    ]
  })
}));

function buildAlertPayload() {
  return {
    id: "alert_1",
    dedupeKey: "worker:degraded:worker_1",
    category: PlatformAlertCategory.worker,
    severity: PlatformAlertSeverity.critical,
    status: PlatformAlertStatus.open,
    summary: "Worker worker_1 is degraded.",
    detail: "RPC timeout",
    routingStatus: "unrouted",
    ownerOperatorId: null,
    acknowledgedAt: null,
    suppressedUntil: null,
    metadata: {
      workerId: "worker_1"
    }
  };
}

function createService() {
  const prismaService = {
    platformAlertDelivery: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn()
    }
  } as unknown as PrismaService;

  return {
    prismaService,
    service: new PlatformAlertDeliveryService(prismaService)
  };
}

describe("PlatformAlertDeliveryService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("enqueues and delivers matching alert events", async () => {
    const { service, prismaService } = createService();

    (prismaService.platformAlertDelivery.create as jest.Mock).mockResolvedValue({
      id: "delivery_1"
    });
    (prismaService.platformAlertDelivery.findMany as jest.Mock).mockResolvedValue([
      {
        id: "delivery_1",
        targetName: "ops-critical",
        targetUrl: "https://ops.example.com/hooks/platform-alerts",
        eventType: "opened",
        status: PlatformAlertDeliveryStatus.pending,
        attemptCount: 0,
        requestPayload: {
          alert: buildAlertPayload()
        }
      }
    ]);
    (prismaService.platformAlertDelivery.findUnique as jest.Mock).mockResolvedValue({
      id: "delivery_1",
      targetName: "ops-critical",
      targetUrl: "https://ops.example.com/hooks/platform-alerts",
      eventType: "opened",
      status: PlatformAlertDeliveryStatus.pending,
      attemptCount: 0,
      requestPayload: {
        alert: buildAlertPayload()
      }
    });
    (axios.post as jest.Mock).mockResolvedValue({
      status: 202
    });

    const queuedCount = await service.enqueueAlertEvent({
      alert: buildAlertPayload(),
      eventType: "opened"
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(queuedCount).toBe(1);
    expect(prismaService.platformAlertDelivery.create).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      "https://ops.example.com/hooks/platform-alerts",
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token"
        }),
        timeout: 5000
      })
    );
    expect(prismaService.platformAlertDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PlatformAlertDeliveryStatus.succeeded,
          responseStatusCode: 202
        })
      })
    );
  });

  it("requeues failed deliveries for retry", async () => {
    const { service, prismaService } = createService();

    (prismaService.platformAlertDelivery.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: "delivery_1" }])
      .mockResolvedValueOnce([]);
    (prismaService.platformAlertDelivery.updateMany as jest.Mock).mockResolvedValue({
      count: 1
    });

    const queuedCount = await service.retryFailedDeliveriesForAlert("alert_1");

    expect(queuedCount).toBe(1);
    expect(prismaService.platformAlertDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PlatformAlertDeliveryStatus.pending
        })
      })
    );
  });
});
