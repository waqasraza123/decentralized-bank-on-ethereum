import axios from "axios";
import {
  loadPlatformAlertDeliveryRuntimeConfig,
  type PlatformAlertDeliveryRuntimeConfig,
  type PlatformAlertDeliveryTargetRuntimeConfig
} from "@stealth-trails-bank/config/api";
import {
  PlatformAlertCategory,
  PlatformAlertDeliveryEventType,
  PlatformAlertDeliveryStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  Prisma
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type PlatformAlertDeliveryPayload = {
  id: string;
  dedupeKey: string;
  category: PlatformAlertCategory;
  severity: PlatformAlertSeverity;
  status: PlatformAlertStatus;
  summary: string;
  detail: string | null;
  routingStatus: string;
  ownerOperatorId: string | null;
  acknowledgedAt: string | null;
  suppressedUntil: string | null;
  metadata: Prisma.JsonValue | null;
};

@Injectable()
export class PlatformAlertDeliveryService {
  private readonly runtimeConfig: PlatformAlertDeliveryRuntimeConfig;

  constructor(private readonly prismaService: PrismaService) {
    this.runtimeConfig = loadPlatformAlertDeliveryRuntimeConfig();
  }

  private severityRank(severity: PlatformAlertSeverity): number {
    return severity === PlatformAlertSeverity.critical ? 2 : 1;
  }

  private shouldDeliverToTarget(
    target: PlatformAlertDeliveryTargetRuntimeConfig,
    alert: PlatformAlertDeliveryPayload,
    eventType: PlatformAlertDeliveryEventType
  ): boolean {
    return (
      target.categories.includes(alert.category) &&
      this.severityRank(alert.severity) >= this.severityRank(target.minimumSeverity) &&
      target.eventTypes.includes(eventType)
    );
  }

  private buildRequestPayload(
    alert: PlatformAlertDeliveryPayload,
    eventType: PlatformAlertDeliveryEventType,
    metadata?: Record<string, unknown>
  ): Prisma.InputJsonValue {
    return {
      eventType,
      generatedAt: new Date().toISOString(),
      alert,
      ...(metadata ? { metadata } : {})
    } as Prisma.InputJsonValue;
  }

  async enqueueAlertEvent(args: {
    alert: PlatformAlertDeliveryPayload;
    eventType: PlatformAlertDeliveryEventType;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    const targets = this.runtimeConfig.targets.filter((target) =>
      this.shouldDeliverToTarget(target, args.alert, args.eventType)
    );

    if (targets.length === 0) {
      return 0;
    }

    const deliveryIds: string[] = [];

    for (const target of targets) {
      const createdDelivery = await this.prismaService.platformAlertDelivery.create({
        data: {
          platformAlertId: args.alert.id,
          targetName: target.name,
          targetUrl: target.url,
          eventType: args.eventType,
          status: PlatformAlertDeliveryStatus.pending,
          attemptCount: 0,
          requestPayload: this.buildRequestPayload(
            args.alert,
            args.eventType,
            args.metadata
          )
        }
      });

      deliveryIds.push(createdDelivery.id);
    }

    void this.processPendingDeliveries(deliveryIds);

    return deliveryIds.length;
  }

  async retryFailedDeliveriesForAlert(alertId: string): Promise<number> {
    const failedDeliveries = await this.prismaService.platformAlertDelivery.findMany({
      where: {
        platformAlertId: alertId,
        status: PlatformAlertDeliveryStatus.failed
      },
      select: {
        id: true
      }
    });

    if (failedDeliveries.length === 0) {
      return 0;
    }

    const deliveryIds = failedDeliveries.map((delivery) => delivery.id);

    await this.prismaService.platformAlertDelivery.updateMany({
      where: {
        id: {
          in: deliveryIds
        }
      },
      data: {
        status: PlatformAlertDeliveryStatus.pending,
        responseStatusCode: null,
        errorMessage: null
      }
    });

    void this.processPendingDeliveries(deliveryIds);

    return deliveryIds.length;
  }

  private async processPendingDeliveries(deliveryIds: string[]): Promise<void> {
    const deliveries = await this.prismaService.platformAlertDelivery.findMany({
      where: {
        id: {
          in: deliveryIds
        },
        status: PlatformAlertDeliveryStatus.pending
      }
    });

    for (const delivery of deliveries) {
      await this.processSingleDelivery(delivery.id);
    }
  }

  private async processSingleDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prismaService.platformAlertDelivery.findUnique({
      where: {
        id: deliveryId
      }
    });

    if (!delivery || delivery.status !== PlatformAlertDeliveryStatus.pending) {
      return;
    }

    const attemptedAt = new Date();

    try {
      const target = this.runtimeConfig.targets.find(
        (candidate) => candidate.name === delivery.targetName
      );

      const response = await axios.post(
        delivery.targetUrl,
        delivery.requestPayload,
        {
          timeout: this.runtimeConfig.requestTimeoutMs,
          headers: {
            "Content-Type": "application/json",
            "X-Stealth-Trails-Alert-Event": delivery.eventType,
            "X-Stealth-Trails-Alert-Target": delivery.targetName,
            ...(target?.bearerToken
              ? {
                  Authorization: `Bearer ${target.bearerToken}`
                }
              : {})
          }
        }
      );

      await this.prismaService.platformAlertDelivery.update({
        where: {
          id: delivery.id
        },
        data: {
          status: PlatformAlertDeliveryStatus.succeeded,
          attemptCount: delivery.attemptCount + 1,
          responseStatusCode: response.status,
          errorMessage: null,
          lastAttemptedAt: attemptedAt,
          deliveredAt: attemptedAt
        }
      });
    } catch (error) {
      const axiosError = axios.isAxiosError(error) ? error : null;
      const errorMessage =
        axiosError?.response?.data && typeof axiosError.response.data === "string"
          ? axiosError.response.data
          : axiosError?.message ?? "Unknown delivery error.";

      await this.prismaService.platformAlertDelivery.update({
        where: {
          id: delivery.id
        },
        data: {
          status: PlatformAlertDeliveryStatus.failed,
          attemptCount: delivery.attemptCount + 1,
          responseStatusCode: axiosError?.response?.status ?? null,
          errorMessage,
          lastAttemptedAt: attemptedAt
        }
      });
    }
  }
}
