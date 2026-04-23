import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { createHash } from "node:crypto";
import { loadIncidentPackageExportGovernanceRuntimeConfig } from "@stealth-trails-bank/config/api";
import { Prisma } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { CustomerAccountIncidentPackageService } from "./customer-account-incident-package.service";
import {
  type IncidentPackageExportMode,
  GetCustomerAccountComplianceExportDto
} from "./dto/get-customer-account-compliance-export.dto";

type BaseIncidentPackageProjection = Awaited<
  ReturnType<CustomerAccountIncidentPackageService["buildIncidentPackage"]>
>;
type BaseTransactionIntentProjection =
  BaseIncidentPackageProjection["recentTransactionIntents"][number];
type BaseRestrictionProjection = BaseIncidentPackageProjection["holdHistory"][number];
type BaseReviewCaseProjection =
  BaseIncidentPackageProjection["reviewCases"][number];
type BaseOversightIncidentProjection =
  BaseIncidentPackageProjection["oversightIncidents"][number];

type GovernedExportMetadata = {
  exportMode: IncidentPackageExportMode;
  generatedAt: string;
  generatedByOperatorId: string;
  generatedByOperatorRole: string | null;
  redactionsApplied: boolean;
  recentLimitRequested: number | null;
  recentLimitApplied: number;
  timelineLimitRequested: number | null;
  timelineLimitApplied: number;
  sinceDaysRequested: number | null;
  sinceDaysApplied: number | null;
  packageChecksumSha256: string;
};

type GovernedComplianceSummary = {
  accountStatus: string;
  activeRestriction: boolean;
  activeRestrictionReasonCode: string | null;
  openReviewCases: number;
  openOversightIncidents: number;
  activeAccountHolds: number;
  manuallyResolvedTransactionIntents: number;
  releaseReviewDecisionStates: {
    decisionStatus: string;
    count: number;
  }[];
  timelineEventBreakdown: {
    eventType: string;
    count: number;
  }[];
};

type GovernedNarrativeProjection = {
  executiveSummary: string;
  controlPosture: string;
  investigationSummary: string;
  complianceObservations: string;
};

type GovernedIncidentPackageExport = {
  exportMetadata: GovernedExportMetadata;
  complianceSummary: GovernedComplianceSummary;
  narrative: GovernedNarrativeProjection;
  package: Prisma.JsonValue;
};

@Injectable()
export class CustomerAccountIncidentPackageExportGovernanceService {
  private readonly incidentPackageExportMaxRecentLimit: number;
  private readonly incidentPackageExportMaxTimelineLimit: number;
  private readonly incidentPackageExportMaxSinceDays: number;

  constructor(
    private readonly customerAccountIncidentPackageService: CustomerAccountIncidentPackageService,
    private readonly prismaService: PrismaService,
    @Optional()
    private readonly notificationsService?: Pick<
      NotificationsService,
      "publishAuditEventRecord"
    >
  ) {
    const config = loadIncidentPackageExportGovernanceRuntimeConfig();
    this.incidentPackageExportMaxRecentLimit =
      config.incidentPackageExportMaxRecentLimit;
    this.incidentPackageExportMaxTimelineLimit =
      config.incidentPackageExportMaxTimelineLimit;
    this.incidentPackageExportMaxSinceDays =
      config.incidentPackageExportMaxSinceDays;
  }

  private async appendAuditEvent(args: Prisma.AuditEventCreateArgs) {
    const auditEvent = await this.prismaService.auditEvent.create(args);

    if (this.notificationsService) {
      await this.notificationsService.publishAuditEventRecord(auditEvent);
    }

    return auditEvent;
  }

  private resolveMode(
    mode?: IncidentPackageExportMode
  ): IncidentPackageExportMode {
    return mode ?? "internal_full";
  }

  private clampRecentLimit(value?: number): number {
    if (!value) {
      return Math.min(20, this.incidentPackageExportMaxRecentLimit);
    }

    return Math.min(value, this.incidentPackageExportMaxRecentLimit);
  }

  private clampTimelineLimit(value?: number): number {
    if (!value) {
      return Math.min(100, this.incidentPackageExportMaxTimelineLimit);
    }

    return Math.min(value, this.incidentPackageExportMaxTimelineLimit);
  }

  private clampSinceDays(value?: number): number | null {
    if (!value) {
      return null;
    }

    return Math.min(value, this.incidentPackageExportMaxSinceDays);
  }

  private buildSinceDate(sinceDays: number | null): Date | null {
    if (!sinceDays) {
      return null;
    }

    const now = new Date();
    const sinceDate = new Date(now);
    sinceDate.setUTCDate(now.getUTCDate() - sinceDays);
    return sinceDate;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  }

  private getIntentMaterialDate(
    intent: BaseTransactionIntentProjection
  ): Date | null {
    return (
      this.parseDate(intent.manuallyResolvedAt) ??
      this.parseDate(intent.updatedAt) ??
      this.parseDate(intent.createdAt)
    );
  }

  private getRestrictionMaterialDate(
    restriction: BaseRestrictionProjection
  ): Date | null {
    return (
      this.parseDate(restriction.releasedAt) ??
      this.parseDate(restriction.appliedAt)
    );
  }

  private getReviewCaseMaterialDate(
    reviewCase: BaseReviewCaseProjection
  ): Date | null {
    return (
      this.parseDate(reviewCase.resolvedAt) ??
      this.parseDate(reviewCase.dismissedAt) ??
      this.parseDate(reviewCase.updatedAt) ??
      this.parseDate(reviewCase.createdAt)
    );
  }

  private getOversightIncidentMaterialDate(
    incident: BaseOversightIncidentProjection
  ): Date | null {
    return (
      this.parseDate(incident.resolvedAt) ??
      this.parseDate(incident.dismissedAt) ??
      this.parseDate(incident.updatedAt) ??
      this.parseDate(incident.createdAt)
    );
  }

  private isOnOrAfter(date: Date | null, sinceDate: Date | null): boolean {
    if (!sinceDate) {
      return true;
    }

    if (!date) {
      return false;
    }

    return date >= sinceDate;
  }

  private filterByWindow(
    pkg: BaseIncidentPackageProjection,
    sinceDays: number | null,
    recentLimit: number,
    timelineLimit: number
  ): BaseIncidentPackageProjection {
    const sinceDate = this.buildSinceDate(sinceDays);

    return {
      ...pkg,
      recentTransactionIntents: pkg.recentTransactionIntents
        .filter((intent) =>
          this.isOnOrAfter(this.getIntentMaterialDate(intent), sinceDate)
        )
        .slice(0, recentLimit),
      holdHistory: pkg.holdHistory
        .filter((restriction) =>
          this.isOnOrAfter(this.getRestrictionMaterialDate(restriction), sinceDate)
        )
        .slice(0, recentLimit),
      reviewCases: pkg.reviewCases
        .filter((reviewCase) =>
          this.isOnOrAfter(this.getReviewCaseMaterialDate(reviewCase), sinceDate)
        )
        .slice(0, recentLimit),
      oversightIncidents: pkg.oversightIncidents
        .filter((incident) =>
          this.isOnOrAfter(
            this.getOversightIncidentMaterialDate(incident),
            sinceDate
          )
        )
        .slice(0, recentLimit),
      timeline: pkg.timeline
        .filter((entry) =>
          this.isOnOrAfter(this.parseDate(entry.occurredAt), sinceDate)
        )
        .slice(0, timelineLimit)
    };
  }

  private maskEmail(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const atIndex = value.indexOf("@");

    if (atIndex <= 1) {
      return "***";
    }

    return value.slice(0, 1) + "***" + value.slice(atIndex);
  }

  private maskAddress(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (value.length <= 10) {
      return "***";
    }

    return value.slice(0, 6) + "..." + value.slice(-4);
  }

  private maskIdentifier(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (value.length <= 6) {
      return "***";
    }

    return value.slice(0, 2) + "***" + value.slice(-2);
  }

  private redactPrimitiveByKey(key: string, value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== "string") {
      return value;
    }

    if (key === "email") {
      return this.maskEmail(value);
    }

    if (
      key === "supabaseUserId" ||
      key === "actorId" ||
      key === "appliedByOperatorId" ||
      key === "releasedByOperatorId" ||
      key === "assignedOperatorId" ||
      key === "manualResolvedByOperatorId" ||
      key === "releaseRequestedByOperatorId" ||
      key === "releaseDecidedByOperatorId" ||
      key === "restrictedByOperatorId" ||
      key === "restrictionReleasedByOperatorId"
    ) {
      return this.maskIdentifier(value);
    }

    if (
      key === "sourceWalletAddress" ||
      key === "destinationWalletAddress" ||
      key === "externalAddress" ||
      key === "fromAddress" ||
      key === "toAddress" ||
      key === "txHash"
    ) {
      return this.maskAddress(value);
    }

    return value;
  }

  private redactJsonValue(value: Prisma.JsonValue): Prisma.JsonValue {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.redactJsonValue(entry)) as Prisma.JsonArray;
    }

    const redactedObject: Prisma.JsonObject = {};

    for (const [key, entryValue] of Object.entries(value)) {
      if (
        entryValue === null ||
        typeof entryValue === "string" ||
        typeof entryValue === "number" ||
        typeof entryValue === "boolean"
      ) {
        redactedObject[key] = this.redactPrimitiveByKey(key, entryValue) as
          | string
          | number
          | boolean
          | null;
        continue;
      }

      redactedObject[key] = this.redactJsonValue(entryValue as Prisma.JsonValue);
    }

    return redactedObject;
  }

  private buildRedactionReadyPackage(
    pkg: BaseIncidentPackageProjection
  ): Prisma.JsonValue {
    return this.redactJsonValue(pkg as unknown as Prisma.JsonValue);
  }

  private buildComplianceFocusedPackage(
    pkg: BaseIncidentPackageProjection,
    complianceSummary: GovernedComplianceSummary
  ): Prisma.JsonValue {
    const materialEventTypes = new Set([
      "transaction_intent.manually_resolved",
      "review_case.account_release_requested",
      "review_case.account_release_approved",
      "review_case.account_release_denied",
      "review_case.manual_resolution_applied",
      "review_case.resolved",
      "oversight_incident.opened",
      "oversight_incident.account_restriction_applied",
      "oversight_incident.account_restriction_released",
      "oversight_incident.resolved",
      "account_hold.applied",
      "account_hold.released"
    ]);

    const materialTimeline = pkg.timeline.filter((entry) =>
      materialEventTypes.has(entry.eventType)
    );

    return {
      customer: {
        customerId: pkg.customer.customerId,
        customerAccountId: pkg.customer.customerAccountId,
        firstName: pkg.customer.firstName,
        lastName: pkg.customer.lastName
      },
      accountStatus: pkg.accountStatus,
      currentRestriction: {
        active: pkg.currentRestriction.active,
        restrictionReasonCode: pkg.currentRestriction.restrictionReasonCode,
        restrictedAt: pkg.currentRestriction.restrictedAt,
        restrictedByOversightIncidentId:
          pkg.currentRestriction.restrictedByOversightIncidentId
      },
      counts: pkg.counts,
      balances: pkg.balances,
      complianceSummary,
      recentTransactionIntents: pkg.recentTransactionIntents.map((intent) => ({
        id: intent.id,
        intentType: intent.intentType,
        status: intent.status,
        requestedAmount: intent.requestedAmount,
        settledAmount: intent.settledAmount,
        manuallyResolvedAt: intent.manuallyResolvedAt,
        manualResolutionReasonCode: intent.manualResolutionReasonCode,
        manualResolutionReviewCaseId: intent.manualResolutionReviewCaseId,
        latestBlockchainTransaction: intent.latestBlockchainTransaction
          ? {
              status: intent.latestBlockchainTransaction.status,
              confirmedAt: intent.latestBlockchainTransaction.confirmedAt
            }
          : null,
        createdAt: intent.createdAt,
        updatedAt: intent.updatedAt
      })),
      activeHolds: pkg.activeHolds.map((restriction) => ({
        id: restriction.id,
        status: restriction.status,
        restrictionReasonCode: restriction.restrictionReasonCode,
        appliedAt: restriction.appliedAt,
        releasedAt: restriction.releasedAt,
        releaseDecisionStatus: restriction.releaseDecisionStatus,
        releaseRequestedAt: restriction.releaseRequestedAt,
        releaseDecidedAt: restriction.releaseDecidedAt,
        releaseReviewCase: restriction.releaseReviewCase
      })),
      holdHistory: pkg.holdHistory.map((restriction) => ({
        id: restriction.id,
        status: restriction.status,
        restrictionReasonCode: restriction.restrictionReasonCode,
        appliedAt: restriction.appliedAt,
        releasedAt: restriction.releasedAt,
        releaseDecisionStatus: restriction.releaseDecisionStatus,
        releaseRequestedAt: restriction.releaseRequestedAt,
        releaseDecidedAt: restriction.releaseDecidedAt,
        releaseReviewCase: restriction.releaseReviewCase
      })),
      reviewCases: pkg.reviewCases.map((reviewCase) => ({
        id: reviewCase.id,
        type: reviewCase.type,
        status: reviewCase.status,
        reasonCode: reviewCase.reasonCode,
        startedAt: reviewCase.startedAt,
        resolvedAt: reviewCase.resolvedAt,
        dismissedAt: reviewCase.dismissedAt,
        createdAt: reviewCase.createdAt,
        updatedAt: reviewCase.updatedAt
      })),
      oversightIncidents: pkg.oversightIncidents.map((incident) => ({
        id: incident.id,
        incidentType: incident.incidentType,
        status: incident.status,
        reasonCode: incident.reasonCode,
        openedAt: incident.openedAt,
        startedAt: incident.startedAt,
        resolvedAt: incident.resolvedAt,
        dismissedAt: incident.dismissedAt,
        updatedAt: incident.updatedAt
      })),
      timeline: materialTimeline
    } as Prisma.JsonValue;
  }

  private buildComplianceSummary(
    pkg: BaseIncidentPackageProjection
  ): GovernedComplianceSummary {
    const releaseDecisionCounts = new Map<string, number>();
    const timelineEventCounts = new Map<string, number>();

    for (const restriction of pkg.holdHistory) {
      releaseDecisionCounts.set(
        restriction.releaseDecisionStatus,
        (releaseDecisionCounts.get(restriction.releaseDecisionStatus) ?? 0) + 1
      );
    }

    for (const timelineEntry of pkg.timeline) {
      timelineEventCounts.set(
        timelineEntry.eventType,
        (timelineEventCounts.get(timelineEntry.eventType) ?? 0) + 1
      );
    }

    return {
      accountStatus: pkg.accountStatus,
      activeRestriction: pkg.currentRestriction.active,
      activeRestrictionReasonCode: pkg.currentRestriction.restrictionReasonCode,
      openReviewCases: pkg.counts.openReviewCases,
      openOversightIncidents: pkg.counts.openOversightIncidents,
      activeAccountHolds: pkg.counts.activeAccountHolds,
      manuallyResolvedTransactionIntents:
        pkg.counts.manuallyResolvedTransactionIntents,
      releaseReviewDecisionStates: Array.from(releaseDecisionCounts.entries())
        .map(([decisionStatus, count]) => ({
          decisionStatus,
          count
        }))
        .sort((left, right) => right.count - left.count),
      timelineEventBreakdown: Array.from(timelineEventCounts.entries())
        .map(([eventType, count]) => ({
          eventType,
          count
        }))
        .sort((left, right) => right.count - left.count)
    };
  }

  private buildNarrative(
    pkg: BaseIncidentPackageProjection,
    complianceSummary: GovernedComplianceSummary
  ): GovernedNarrativeProjection {
    const fullName = [pkg.customer.firstName, pkg.customer.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const executiveSummary =
      "Customer account " +
      pkg.customer.customerAccountId +
      " is currently " +
      pkg.accountStatus +
      ", with " +
      complianceSummary.openReviewCases +
      " open review case(s), " +
      complianceSummary.openOversightIncidents +
      " open oversight incident(s), and " +
      complianceSummary.activeAccountHolds +
      " active hold record(s).";

    const controlPosture = complianceSummary.activeRestriction
      ? "An active restriction is currently in effect for this customer account."
      : "No active restriction is currently in effect for this customer account. The latest restriction reason code is " +
        (complianceSummary.activeRestrictionReasonCode ?? "n/a") +
        ".";

    const investigationSummary =
      "The package contains " +
      pkg.reviewCases.length +
      " review case record(s), " +
      pkg.oversightIncidents.length +
      " oversight incident record(s), and " +
      pkg.timeline.length +
      " timeline event(s) within the applied export scope for " +
      (fullName || pkg.customer.customerAccountId) +
      ".";

    const complianceObservations =
      "The account has " +
      complianceSummary.manuallyResolvedTransactionIntents +
      " manually resolved transaction intent(s) in scope. Release-review decision states recorded in scope: " +
      (complianceSummary.releaseReviewDecisionStates.length > 0
        ? complianceSummary.releaseReviewDecisionStates
            .map(
              (entry) => entry.decisionStatus + "=" + entry.count.toString()
            )
            .join(", ")
        : "none") +
      ".";

    return {
      executiveSummary,
      controlPosture,
      investigationSummary,
      complianceObservations
    };
  }

  private buildChecksum(value: Prisma.JsonValue): string {
    return createHash("sha256")
      .update(JSON.stringify(value))
      .digest("hex");
  }

  private async writeExportAuditEvent(
    pkg: BaseIncidentPackageProjection,
    exportMetadata: GovernedExportMetadata
  ): Promise<void> {
    await this.appendAuditEvent({
      data: {
        customerId: pkg.customer.customerId,
        actorType: "operator",
        actorId: exportMetadata.generatedByOperatorId,
        action: "customer_account.incident_package_exported",
        targetType: "CustomerAccount",
        targetId: pkg.customer.customerAccountId,
        metadata: {
          exportMode: exportMetadata.exportMode,
          generatedAt: exportMetadata.generatedAt,
          generatedByOperatorId: exportMetadata.generatedByOperatorId,
          generatedByOperatorRole: exportMetadata.generatedByOperatorRole,
          redactionsApplied: exportMetadata.redactionsApplied,
          recentLimitRequested: exportMetadata.recentLimitRequested,
          recentLimitApplied: exportMetadata.recentLimitApplied,
          timelineLimitRequested: exportMetadata.timelineLimitRequested,
          timelineLimitApplied: exportMetadata.timelineLimitApplied,
          sinceDaysRequested: exportMetadata.sinceDaysRequested,
          sinceDaysApplied: exportMetadata.sinceDaysApplied,
          packageChecksumSha256: exportMetadata.packageChecksumSha256,
          reviewCaseCount: pkg.reviewCases.length,
          oversightIncidentCount: pkg.oversightIncidents.length,
          restrictionCount: pkg.holdHistory.length,
          recentTransactionIntentCount: pkg.recentTransactionIntents.length,
          timelineEventCount: pkg.timeline.length
        } as PrismaJsonValue
      }
    });
  }

  private buildExportMetadata(
    mode: IncidentPackageExportMode,
    operatorId: string,
    operatorRole: string | undefined,
    recentLimitRequested: number | undefined,
    recentLimitApplied: number,
    timelineLimitRequested: number | undefined,
    timelineLimitApplied: number,
    sinceDaysRequested: number | undefined,
    sinceDaysApplied: number | null,
    governedPackage: Prisma.JsonValue
  ): GovernedExportMetadata {
    return {
      exportMode: mode,
      generatedAt: new Date().toISOString(),
      generatedByOperatorId: operatorId,
      generatedByOperatorRole: operatorRole?.trim().toLowerCase() ?? null,
      redactionsApplied: mode === "redaction_ready",
      recentLimitRequested: recentLimitRequested ?? null,
      recentLimitApplied,
      timelineLimitRequested: timelineLimitRequested ?? null,
      timelineLimitApplied,
      sinceDaysRequested: sinceDaysRequested ?? null,
      sinceDaysApplied,
      packageChecksumSha256: this.buildChecksum(governedPackage)
    };
  }

  private buildGovernedPackage(
    pkg: BaseIncidentPackageProjection,
    mode: IncidentPackageExportMode,
    complianceSummary: GovernedComplianceSummary
  ): Prisma.JsonValue {
    if (mode === "redaction_ready") {
      return this.buildRedactionReadyPackage(pkg);
    }

    if (mode === "compliance_focused") {
      return this.buildComplianceFocusedPackage(pkg, complianceSummary);
    }

    return pkg as unknown as Prisma.JsonValue;
  }

  private renderGovernedMarkdown(
    exportEnvelope: GovernedIncidentPackageExport
  ): string {
    const lines: string[] = [];

    lines.push("# Customer Account Governed Incident Package Export");
    lines.push("");
    lines.push("Mode: " + exportEnvelope.exportMetadata.exportMode);
    lines.push("Generated at: " + exportEnvelope.exportMetadata.generatedAt);
    lines.push(
      "Generated by operator id: " +
        exportEnvelope.exportMetadata.generatedByOperatorId
    );
    lines.push(
      "Generated by operator role: " +
        (exportEnvelope.exportMetadata.generatedByOperatorRole ?? "n/a")
    );
    lines.push(
      "Redactions applied: " +
        (exportEnvelope.exportMetadata.redactionsApplied ? "yes" : "no")
    );
    lines.push(
      "Recent limit applied: " +
        exportEnvelope.exportMetadata.recentLimitApplied.toString()
    );
    lines.push(
      "Timeline limit applied: " +
        exportEnvelope.exportMetadata.timelineLimitApplied.toString()
    );
    lines.push(
      "Since days applied: " +
        (exportEnvelope.exportMetadata.sinceDaysApplied?.toString() ?? "n/a")
    );
    lines.push(
      "Checksum sha256: " + exportEnvelope.exportMetadata.packageChecksumSha256
    );
    lines.push("");
    lines.push("## Narrative");
    lines.push("");
    lines.push("- Executive summary: " + exportEnvelope.narrative.executiveSummary);
    lines.push("- Control posture: " + exportEnvelope.narrative.controlPosture);
    lines.push(
      "- Investigation summary: " +
        exportEnvelope.narrative.investigationSummary
    );
    lines.push(
      "- Compliance observations: " +
        exportEnvelope.narrative.complianceObservations
    );
    lines.push("");
    lines.push("## Compliance Summary");
    lines.push("");
    lines.push(
      "- Account status: " + exportEnvelope.complianceSummary.accountStatus
    );
    lines.push(
      "- Active restriction: " +
        (exportEnvelope.complianceSummary.activeRestriction ? "yes" : "no")
    );
    lines.push(
      "- Active restriction reason code: " +
        (exportEnvelope.complianceSummary.activeRestrictionReasonCode ?? "n/a")
    );
    lines.push(
      "- Open review cases: " +
        exportEnvelope.complianceSummary.openReviewCases.toString()
    );
    lines.push(
      "- Open oversight incidents: " +
        exportEnvelope.complianceSummary.openOversightIncidents.toString()
    );
    lines.push(
      "- Active account holds: " +
        exportEnvelope.complianceSummary.activeAccountHolds.toString()
    );
    lines.push(
      "- Manually resolved transaction intents: " +
        exportEnvelope.complianceSummary.manuallyResolvedTransactionIntents.toString()
    );
    lines.push("");
    lines.push("### Release Review Decision States");
    lines.push("");

    if (exportEnvelope.complianceSummary.releaseReviewDecisionStates.length === 0) {
      lines.push("- none");
    } else {
      for (const entry of exportEnvelope.complianceSummary.releaseReviewDecisionStates) {
        lines.push("- " + entry.decisionStatus + ": " + entry.count.toString());
      }
    }

    lines.push("");
    lines.push("### Timeline Event Breakdown");
    lines.push("");

    if (exportEnvelope.complianceSummary.timelineEventBreakdown.length === 0) {
      lines.push("- none");
    } else {
      for (const entry of exportEnvelope.complianceSummary.timelineEventBreakdown) {
        lines.push("- " + entry.eventType + ": " + entry.count.toString());
      }
    }

    lines.push("");
    lines.push("## Governed Package Payload");
    lines.push("");

    for (const line of JSON.stringify(exportEnvelope.package, null, 2).split("\n")) {
      lines.push("    " + line);
    }

    return lines.join("\n");
  }

  async getGovernedIncidentPackageExport(
    query: GetCustomerAccountComplianceExportDto,
    operatorId: string,
    operatorRole?: string
  ): Promise<GovernedIncidentPackageExport> {
    const mode = this.resolveMode(query.mode);
    const recentLimitApplied = this.clampRecentLimit(query.recentLimit);
    const timelineLimitApplied = this.clampTimelineLimit(query.timelineLimit);
    const sinceDaysApplied = this.clampSinceDays(query.sinceDays);

    const pkg = await this.customerAccountIncidentPackageService.buildIncidentPackage(
      {
        customerAccountId: query.customerAccountId,
        supabaseUserId: query.supabaseUserId,
        recentLimit: recentLimitApplied,
        timelineLimit: timelineLimitApplied
      }
    );

    if (!pkg) {
      throw new NotFoundException("Customer account incident package not found.");
    }

    const windowedPackage = this.filterByWindow(
      pkg,
      sinceDaysApplied,
      recentLimitApplied,
      timelineLimitApplied
    );

    const complianceSummary = this.buildComplianceSummary(windowedPackage);
    const governedPackage = this.buildGovernedPackage(
      windowedPackage,
      mode,
      complianceSummary
    );
    const exportMetadata = this.buildExportMetadata(
      mode,
      operatorId,
      operatorRole,
      query.recentLimit,
      recentLimitApplied,
      query.timelineLimit,
      timelineLimitApplied,
      query.sinceDays,
      sinceDaysApplied,
      governedPackage
    );
    const narrative = this.buildNarrative(windowedPackage, complianceSummary);

    await this.writeExportAuditEvent(windowedPackage, exportMetadata);

    return {
      exportMetadata,
      complianceSummary,
      narrative,
      package: governedPackage
    };
  }

  async getGovernedIncidentPackageExportMarkdown(
    query: GetCustomerAccountComplianceExportDto,
    operatorId: string,
    operatorRole?: string
  ): Promise<{ markdown: string }> {
    const exportEnvelope = await this.getGovernedIncidentPackageExport(
      query,
      operatorId,
      operatorRole
    );

    return {
      markdown: this.renderGovernedMarkdown(exportEnvelope)
    };
  }
}
