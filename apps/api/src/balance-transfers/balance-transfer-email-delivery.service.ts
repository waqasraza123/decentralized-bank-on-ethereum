import axios from "axios";
import { Injectable } from "@nestjs/common";
import {
  PlatformAlertCategory,
  PlatformAlertDeliveryEventType,
  PlatformAlertRoutingStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  Prisma,
} from "@prisma/client";
import {
  loadCustomerTransferEmailDeliveryRuntimeConfig,
  type CustomerTransferEmailDeliveryRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";

type BalanceTransferEmailPurpose =
  | "created"
  | "review_required"
  | "settled"
  | "denied";

type BalanceTransferEmailRole = "sender" | "recipient";

type SendBalanceTransferEmailInput = {
  customerId: string;
  actorId: string;
  email: string;
  role: BalanceTransferEmailRole;
  purpose: BalanceTransferEmailPurpose;
  transferId: string;
  assetSymbol: string;
  amount: string;
  counterpartyMaskedDisplay: string | null;
  counterpartyMaskedEmail: string | null;
  createdAt: string;
  note?: string | null;
};

type PlatformAlertRecord = Prisma.PlatformAlertGetPayload<{}>;

@Injectable()
export class BalanceTransferEmailDeliveryService {
  private readonly runtimeConfig: CustomerTransferEmailDeliveryRuntimeConfig;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly platformAlertDeliveryService: PlatformAlertDeliveryService
  ) {
    this.runtimeConfig = loadCustomerTransferEmailDeliveryRuntimeConfig();
  }

  private sanitizeText(value: string | null | undefined, maxLength: number): string {
    return (value ?? "").trim().slice(0, maxLength);
  }

  private buildFailureAlertDedupeKey(
    purpose: BalanceTransferEmailPurpose
  ): string {
    return `balance_transfer_email_delivery_failed:${this.runtimeConfig.mode}:${purpose}`;
  }

  private buildDeliveryPayload(alert: PlatformAlertRecord) {
    return {
      id: alert.id,
      dedupeKey: alert.dedupeKey,
      category: alert.category,
      severity: alert.severity,
      status: alert.status,
      summary: alert.summary,
      detail: alert.detail,
      routingStatus: alert.routingStatus,
      ownerOperatorId: alert.ownerOperatorId,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      suppressedUntil: alert.suppressedUntil?.toISOString() ?? null,
      metadata: alert.metadata,
    };
  }

  private buildAuditMetadata(
    input: SendBalanceTransferEmailInput & {
      backendType: "preview" | "webhook";
      backendReference?: string | null;
      httpStatus?: number | null;
      failureReason?: string | null;
    }
  ): PrismaJsonValue {
    return {
      email: input.email,
      role: input.role,
      purpose: input.purpose,
      transferId: input.transferId,
      assetSymbol: input.assetSymbol,
      amount: input.amount,
      counterpartyMaskedDisplay: input.counterpartyMaskedDisplay,
      counterpartyMaskedEmail: input.counterpartyMaskedEmail,
      createdAt: input.createdAt,
      note: input.note ?? null,
      deliveryBackendType: input.backendType,
      deliveryBackendReference: input.backendReference ?? null,
      deliveryHttpStatus: input.httpStatus ?? null,
      deliveryFailureReason: input.failureReason ?? null,
      fromEmail: this.runtimeConfig.fromEmail,
      fromName: this.runtimeConfig.fromName,
      deliveryMode: this.runtimeConfig.mode,
    } as PrismaJsonValue;
  }

  private async appendAuditEvent(input: {
    customerId: string;
    actorId: string;
    action: string;
    targetId: string;
    metadata: PrismaJsonValue;
  }) {
    await this.prismaService.auditEvent.create({
      data: {
        customerId: input.customerId,
        actorType: "system",
        actorId: input.actorId,
        action: input.action,
        targetType: "TransactionIntent",
        targetId: input.targetId,
        metadata: input.metadata,
      },
    });
  }

  private async resolveFailureAlert(dedupeKey: string): Promise<void> {
    const existingAlert = await this.prismaService.platformAlert.findUnique({
      where: { dedupeKey },
    });

    if (!existingAlert || existingAlert.status === PlatformAlertStatus.resolved) {
      return;
    }

    await this.prismaService.platformAlert.update({
      where: { id: existingAlert.id },
      data: {
        status: PlatformAlertStatus.resolved,
        resolvedAt: new Date(),
      },
    });
  }

  private async upsertFailureAlert(input: {
    purpose: BalanceTransferEmailPurpose;
    failureReason: string;
    email: string;
  }): Promise<void> {
    const dedupeKey = this.buildFailureAlertDedupeKey(input.purpose);
    const detectedAt = new Date();
    const existingAlert = await this.prismaService.platformAlert.findUnique({
      where: { dedupeKey },
    });

    const metadata = {
      source: "balance_transfer_email_delivery",
      purpose: input.purpose,
      deliveryMode: this.runtimeConfig.mode,
      email: input.email,
      webhookUrl: this.runtimeConfig.webhookUrl,
      failureReason: input.failureReason,
      detectedAt: detectedAt.toISOString(),
    } as PrismaJsonValue;

    if (!existingAlert) {
      const createdAlert = await this.prismaService.platformAlert.create({
        data: {
          dedupeKey,
          category: PlatformAlertCategory.operations,
          severity: PlatformAlertSeverity.critical,
          status: PlatformAlertStatus.open,
          routingStatus: PlatformAlertRoutingStatus.unrouted,
          code: "balance_transfer_email_delivery_failed",
          summary: "Balance transfer email delivery failed.",
          detail: this.sanitizeText(input.failureReason, 1000),
          metadata,
          firstDetectedAt: detectedAt,
          lastDetectedAt: detectedAt,
        },
      });

      void this.platformAlertDeliveryService.enqueueAlertEvent({
        alert: this.buildDeliveryPayload(createdAlert),
        eventType: PlatformAlertDeliveryEventType.opened,
        metadata: {
          source: "balance_transfer_email_delivery",
          purpose: input.purpose,
        },
      });
      return;
    }

    const reopened = existingAlert.status === PlatformAlertStatus.resolved;
    const updatedAlert = await this.prismaService.platformAlert.update({
      where: { id: existingAlert.id },
      data: {
        status: PlatformAlertStatus.open,
        resolvedAt: null,
        routingStatus: reopened
          ? PlatformAlertRoutingStatus.unrouted
          : existingAlert.routingStatus,
        detail: this.sanitizeText(input.failureReason, 1000),
        metadata,
        lastDetectedAt: detectedAt,
      },
    });

    if (reopened) {
      void this.platformAlertDeliveryService.enqueueAlertEvent({
        alert: this.buildDeliveryPayload(updatedAlert),
        eventType: PlatformAlertDeliveryEventType.reopened,
        metadata: {
          source: "balance_transfer_email_delivery",
          purpose: input.purpose,
          reopened: true,
        },
      });
    }
  }

  async sendTransferEmail(input: SendBalanceTransferEmailInput): Promise<void> {
    const failureAlertDedupeKey = this.buildFailureAlertDedupeKey(input.purpose);

    if (this.runtimeConfig.mode === "preview") {
      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "transaction_intent.internal_balance_transfer.email_delivery_succeeded",
        targetId: input.transferId,
        metadata: this.buildAuditMetadata({
          ...input,
          backendType: "preview",
        }),
      });
      await this.resolveFailureAlert(failureAlertDedupeKey);
      return;
    }

    try {
      const response = await axios.post(
        this.runtimeConfig.webhookUrl!,
        {
          type: "customer_balance_transfer_email",
          from: {
            email: this.runtimeConfig.fromEmail,
            name: this.runtimeConfig.fromName,
          },
          recipient: {
            email: input.email,
          },
          transferEvent: {
            role: input.role,
            purpose: input.purpose,
            transferId: input.transferId,
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            counterpartyMaskedDisplay: input.counterpartyMaskedDisplay,
            counterpartyMaskedEmail: input.counterpartyMaskedEmail,
            createdAt: input.createdAt,
            note: input.note ?? null,
          },
        },
        {
          timeout: this.runtimeConfig.requestTimeoutMs,
          headers: {
            ...(this.runtimeConfig.bearerToken
              ? {
                  Authorization: `Bearer ${this.runtimeConfig.bearerToken}`,
                }
              : {}),
          },
        }
      );

      const backendReference =
        response.data &&
        typeof response.data === "object" &&
        !Array.isArray(response.data) &&
        typeof response.data["deliveryId"] === "string"
          ? response.data["deliveryId"]
          : null;

      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "transaction_intent.internal_balance_transfer.email_delivery_succeeded",
        targetId: input.transferId,
        metadata: this.buildAuditMetadata({
          ...input,
          backendType: "webhook",
          backendReference,
          httpStatus: response.status,
        }),
      });
      await this.resolveFailureAlert(failureAlertDedupeKey);
    } catch (error) {
      const responseStatus =
        axios.isAxiosError(error) && error.response?.status
          ? error.response.status
          : null;
      const failureReason =
        (axios.isAxiosError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown balance transfer email delivery failure.") ||
        "Unknown balance transfer email delivery failure.";

      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "transaction_intent.internal_balance_transfer.email_delivery_failed",
        targetId: input.transferId,
        metadata: this.buildAuditMetadata({
          ...input,
          backendType: "webhook",
          httpStatus: responseStatus,
          failureReason,
        }),
      });

      await this.upsertFailureAlert({
        purpose: input.purpose,
        failureReason,
        email: input.email,
      });
    }
  }
}
