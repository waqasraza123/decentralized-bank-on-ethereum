import { Injectable } from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  BlockchainTransactionStatus,
  Prisma,
  ReviewCaseType,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GetManualResolutionSummaryDto } from "./dto/get-manual-resolution-summary.dto";
import { ListManuallyResolvedIntentsDto } from "./dto/list-manually-resolved-intents.dto";
import { ListManuallyResolvedReviewCasesDto } from "./dto/list-manually-resolved-review-cases.dto";

const manuallyResolvedIntentInclude = {
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true
    }
  },
  sourceWallet: {
    select: {
      id: true,
      address: true
    }
  },
  destinationWallet: {
    select: {
      id: true,
      address: true
    }
  },
  customerAccount: {
    select: {
      id: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          supabaseUserId: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  blockchainTransactions: {
    orderBy: {
      createdAt: "desc"
    },
    take: 1,
    select: {
      id: true,
      txHash: true,
      status: true,
      fromAddress: true,
      toAddress: true,
      createdAt: true,
      updatedAt: true,
      confirmedAt: true
    }
  }
} satisfies Prisma.TransactionIntentInclude;

type ManualResolutionIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: typeof manuallyResolvedIntentInclude;
}>;

type LatestBlockchainTransactionProjection = {
  id: string;
  txHash: string | null;
  status: BlockchainTransactionStatus;
  fromAddress: string | null;
  toAddress: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

type ManuallyResolvedIntentProjection = {
  id: string;
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: TransactionIntentType;
  requestedAmount: string;
  settledAmount: string | null;
  failureCode: string | null;
  failureReason: string | null;
  sourceWalletAddress: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  manuallyResolvedAt: string;
  manualResolutionReasonCode: string | null;
  manualResolutionNote: string | null;
  manualResolvedByOperatorId: string | null;
  manualResolutionOperatorRole: string | null;
  manualResolutionReviewCaseId: string | null;
  latestBlockchainTransaction: LatestBlockchainTransactionProjection | null;
};

type ManuallyResolvedReviewCaseProjection = {
  reviewCase: {
    id: string;
    type: ReviewCaseType;
    status: string;
    reasonCode: string | null;
    assignedOperatorId: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
  };
  customer: {
    customerId: string | null;
    customerAccountId: string | null;
    email: string | null;
    supabaseUserId: string | null;
    firstName: string;
    lastName: string;
  };
  transactionIntent: ManuallyResolvedIntentProjection;
};

type ManualResolutionSummaryResult = {
  totalIntents: number;
  byIntentType: {
    intentType: string;
    count: number;
  }[];
  byReasonCode: {
    manualResolutionReasonCode: string;
    count: number;
  }[];
  byOperator: {
    manualResolvedByOperatorId: string;
    manualResolutionOperatorRole: string | null;
    count: number;
  }[];
};

type ListManuallyResolvedIntentsResult = {
  intents: ManuallyResolvedIntentProjection[];
  limit: number;
};

type ListManuallyResolvedReviewCasesResult = {
  reviewCases: ManuallyResolvedReviewCaseProjection[];
  limit: number;
};

@Injectable()
export class ManualResolutionReportingService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private mapLatestBlockchainTransaction(
    intent: ManualResolutionIntentRecord
  ): LatestBlockchainTransactionProjection | null {
    const latestBlockchainTransaction = intent.blockchainTransactions[0];

    if (!latestBlockchainTransaction) {
      return null;
    }

    return {
      id: latestBlockchainTransaction.id,
      txHash: latestBlockchainTransaction.txHash,
      status: latestBlockchainTransaction.status,
      fromAddress: latestBlockchainTransaction.fromAddress,
      toAddress: latestBlockchainTransaction.toAddress,
      createdAt: latestBlockchainTransaction.createdAt.toISOString(),
      updatedAt: latestBlockchainTransaction.updatedAt.toISOString(),
      confirmedAt: latestBlockchainTransaction.confirmedAt?.toISOString() ?? null
    };
  }

  private mapManuallyResolvedIntentProjection(
    intent: ManualResolutionIntentRecord
  ): ManuallyResolvedIntentProjection {
    return {
      id: intent.id,
      customer: {
        customerId: intent.customerAccount!.customer.id,
        customerAccountId: intent.customerAccount!.id,
        supabaseUserId: intent.customerAccount!.customer.supabaseUserId,
        email: intent.customerAccount!.customer.email,
        firstName: intent.customerAccount!.customer.firstName ?? "",
        lastName: intent.customerAccount!.customer.lastName ?? ""
      },
      asset: {
        id: intent.asset.id,
        symbol: intent.asset.symbol,
        displayName: intent.asset.displayName,
        decimals: intent.asset.decimals,
        chainId: intent.asset.chainId
      },
      intentType: intent.intentType,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      failureCode: intent.failureCode,
      failureReason: intent.failureReason,
      sourceWalletAddress: intent.sourceWallet?.address ?? null,
      destinationWalletAddress: intent.destinationWallet?.address ?? null,
      externalAddress: intent.externalAddress ?? null,
      manuallyResolvedAt: intent.manuallyResolvedAt!.toISOString(),
      manualResolutionReasonCode: intent.manualResolutionReasonCode,
      manualResolutionNote: intent.manualResolutionNote,
      manualResolvedByOperatorId: intent.manualResolvedByOperatorId,
      manualResolutionOperatorRole: intent.manualResolutionOperatorRole,
      manualResolutionReviewCaseId: intent.manualResolutionReviewCaseId,
      latestBlockchainTransaction: this.mapLatestBlockchainTransaction(intent)
    };
  }

  private buildIntentWhereInput(
    query: {
      intentType?: "deposit" | "withdrawal";
      customerAccountId?: string;
      supabaseUserId?: string;
      email?: string;
      manualResolutionReasonCode?: string;
      manualResolvedByOperatorId?: string;
      sinceDays?: number;
    }
  ): Prisma.TransactionIntentWhereInput {
    const where: Prisma.TransactionIntentWhereInput = {
      chainId: this.productChainId,
      manuallyResolvedAt: {
        not: null
      }
    };

    if (query.intentType) {
      where.intentType = query.intentType as TransactionIntentType;
    }

    if (query.customerAccountId?.trim()) {
      where.customerAccountId = query.customerAccountId.trim();
    }

    if (query.manualResolutionReasonCode?.trim()) {
      where.manualResolutionReasonCode = query.manualResolutionReasonCode.trim();
    }

    if (query.manualResolvedByOperatorId?.trim()) {
      where.manualResolvedByOperatorId = query.manualResolvedByOperatorId.trim();
    }

    if (query.supabaseUserId?.trim() || query.email?.trim()) {
      const customerWhere: Prisma.CustomerWhereInput = {};

      if (query.supabaseUserId?.trim()) {
        customerWhere.supabaseUserId = query.supabaseUserId.trim();
      }

      if (query.email?.trim()) {
        customerWhere.email = query.email.trim().toLowerCase();
      }

      where.customerAccount = {
        is: {
          customer: {
            is: customerWhere
          }
        }
      };
    }

    if (query.sinceDays) {
      const now = new Date();
      const sinceDate = new Date(now);
      sinceDate.setUTCDate(now.getUTCDate() - query.sinceDays);

      where.manuallyResolvedAt = {
        gte: sinceDate
      };
    }

    return where;
  }

  async listManuallyResolvedIntents(
    query: ListManuallyResolvedIntentsDto
  ): Promise<ListManuallyResolvedIntentsResult> {
    const limit = query.limit ?? 20;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: this.buildIntentWhereInput(query),
      orderBy: {
        manuallyResolvedAt: "desc"
      },
      take: limit,
      include: manuallyResolvedIntentInclude
    });

    return {
      intents: intents.map((intent) =>
        this.mapManuallyResolvedIntentProjection(intent)
      ),
      limit
    };
  }

  async listManuallyResolvedReviewCases(
    query: ListManuallyResolvedReviewCasesDto
  ): Promise<ListManuallyResolvedReviewCasesResult> {
    const limit = query.limit ?? 20;
    const where: Prisma.ReviewCaseWhereInput = {
      transactionIntent: {
        is: {
          chainId: this.productChainId,
          manuallyResolvedAt: {
            not: null
          }
        }
      }
    };

    if (query.type) {
      where.type = query.type as ReviewCaseType;
    }

    if (query.assignedOperatorId?.trim()) {
      where.assignedOperatorId = query.assignedOperatorId.trim();
    }

    if (query.email?.trim()) {
      where.customer = {
        is: {
          email: query.email.trim().toLowerCase()
        }
      };
    }

    const transactionIntentWhere = where.transactionIntent?.is;

    if (transactionIntentWhere && query.manualResolutionReasonCode?.trim()) {
      transactionIntentWhere.manualResolutionReasonCode =
        query.manualResolutionReasonCode.trim();
    }

    if (transactionIntentWhere && query.manualResolvedByOperatorId?.trim()) {
      transactionIntentWhere.manualResolvedByOperatorId =
        query.manualResolvedByOperatorId.trim();
    }

    const reviewCases = await this.prismaService.reviewCase.findMany({
      where,
      orderBy: {
        updatedAt: "desc"
      },
      take: limit,
      include: {
        customer: {
          select: {
            id: true,
            supabaseUserId: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        transactionIntent: {
          include: manuallyResolvedIntentInclude
        }
      }
    });

    return {
      reviewCases: reviewCases.map((reviewCase) => ({
        reviewCase: {
          id: reviewCase.id,
          type: reviewCase.type,
          status: reviewCase.status,
          reasonCode: reviewCase.reasonCode,
          assignedOperatorId: reviewCase.assignedOperatorId,
          createdAt: reviewCase.createdAt.toISOString(),
          updatedAt: reviewCase.updatedAt.toISOString(),
          resolvedAt: reviewCase.resolvedAt?.toISOString() ?? null
        },
        customer: {
          customerId: reviewCase.customer?.id ?? null,
          customerAccountId: reviewCase.customerAccountId,
          email: reviewCase.customer?.email ?? null,
          supabaseUserId: reviewCase.customer?.supabaseUserId ?? null,
          firstName: reviewCase.customer?.firstName ?? "",
          lastName: reviewCase.customer?.lastName ?? ""
        },
        transactionIntent: this.mapManuallyResolvedIntentProjection(
          reviewCase.transactionIntent!
        )
      })),
      limit
    };
  }

  async getManualResolutionSummary(
    query: GetManualResolutionSummaryDto
  ): Promise<ManualResolutionSummaryResult> {
    const intents = await this.prismaService.transactionIntent.findMany({
      where: this.buildIntentWhereInput(query),
      select: {
        intentType: true,
        manualResolutionReasonCode: true,
        manualResolvedByOperatorId: true,
        manualResolutionOperatorRole: true
      }
    });

    const byIntentType = new Map<string, number>();
    const byReasonCode = new Map<string, number>();
    const byOperator = new Map<string, { role: string | null; count: number }>();

    for (const intent of intents) {
      const intentTypeKey = intent.intentType;
      byIntentType.set(intentTypeKey, (byIntentType.get(intentTypeKey) ?? 0) + 1);

      const reasonCodeKey =
        intent.manualResolutionReasonCode ?? "unknown_reason_code";
      byReasonCode.set(reasonCodeKey, (byReasonCode.get(reasonCodeKey) ?? 0) + 1);

      const operatorKey = intent.manualResolvedByOperatorId ?? "unknown_operator";
      const existingOperatorAggregate = byOperator.get(operatorKey);

      byOperator.set(operatorKey, {
        role: intent.manualResolutionOperatorRole,
        count: (existingOperatorAggregate?.count ?? 0) + 1
      });
    }

    return {
      totalIntents: intents.length,
      byIntentType: Array.from(byIntentType.entries())
        .map(([intentType, count]) => ({
          intentType,
          count
        }))
        .sort((left, right) => right.count - left.count),
      byReasonCode: Array.from(byReasonCode.entries())
        .map(([manualResolutionReasonCode, count]) => ({
          manualResolutionReasonCode,
          count
        }))
        .sort((left, right) => right.count - left.count),
      byOperator: Array.from(byOperator.entries())
        .map(([manualResolvedByOperatorId, aggregate]) => ({
          manualResolvedByOperatorId,
          manualResolutionOperatorRole: aggregate.role,
          count: aggregate.count
        }))
        .sort((left, right) => right.count - left.count)
    };
  }
}
