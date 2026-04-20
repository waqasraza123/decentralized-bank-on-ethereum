import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  AssetStatus,
  PolicyDecision,
  Prisma,
  RetirementVaultEventType,
  RetirementVaultStatus,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRetirementVaultDto } from "./dto/create-retirement-vault.dto";
import { FundRetirementVaultDto } from "./dto/fund-retirement-vault.dto";

const retirementVaultAssetInclude = {
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true
    }
  }
} satisfies Prisma.RetirementVaultInclude;

type RetirementVaultRecord = Prisma.RetirementVaultGetPayload<{
  include: typeof retirementVaultAssetInclude;
}>;

type RetirementVaultFundingIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: {
    asset: {
      select: {
        id: true;
        symbol: true;
        displayName: true;
        decimals: true;
        chainId: true;
      };
    };
    retirementVault: {
      select: {
        id: true;
      };
    };
  };
}>;

type CustomerAssetContext = {
  customerId: string;
  customerAccountId: string;
  assetId: string;
  assetSymbol: string;
};

type RetirementVaultProjection = {
  id: string;
  customerAccountId: string;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  status: RetirementVaultStatus;
  strictMode: boolean;
  unlockAt: string;
  lockedBalance: string;
  fundedAt: string | null;
  lastFundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RetirementVaultFundingIntentProjection = {
  id: string;
  retirementVaultId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: string;
  settledAmount: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

type ListMyRetirementVaultsResult = {
  customerAccountId: string;
  vaults: RetirementVaultProjection[];
};

type CreateMyRetirementVaultResult = {
  vault: RetirementVaultProjection;
  created: boolean;
};

type FundMyRetirementVaultResult = {
  vault: RetirementVaultProjection;
  intent: RetirementVaultFundingIntentProjection;
  idempotencyReused: boolean;
};

@Injectable()
export class RetirementVaultService {
  private readonly productChainId: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ledgerService: LedgerService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private normalizeAssetSymbol(assetSymbol: string): string {
    const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();

    if (!normalizedAssetSymbol) {
      throw new NotFoundException("Asset symbol is required.");
    }

    return normalizedAssetSymbol;
  }

  private parseRequestedAmount(amount: string): Prisma.Decimal {
    const requestedAmount = new Prisma.Decimal(amount);

    if (requestedAmount.lte(0)) {
      throw new BadRequestException(
        "Requested amount must be greater than zero."
      );
    }

    return requestedAmount;
  }

  private parseUnlockAt(unlockAt: string): Date {
    const parsedUnlockAt = new Date(unlockAt);

    if (Number.isNaN(parsedUnlockAt.getTime())) {
      throw new BadRequestException("unlockAt must be a valid ISO-8601 date.");
    }

    if (parsedUnlockAt <= new Date()) {
      throw new BadRequestException(
        "Retirement vault unlockAt must be in the future."
      );
    }

    return parsedUnlockAt;
  }

  private assertSensitiveVaultRequestAllowed(
    accountStatus: AccountLifecycleStatus
  ): void {
    if (accountStatus === AccountLifecycleStatus.restricted) {
      throw new ConflictException(
        "Customer account is currently under a risk hold and cannot create retirement vault requests."
      );
    }

    if (
      accountStatus === AccountLifecycleStatus.frozen ||
      accountStatus === AccountLifecycleStatus.closed
    ) {
      throw new ConflictException(
        "Customer account is not eligible for retirement vault requests in its current lifecycle state."
      );
    }
  }

  private async resolveCustomerAssetContext(
    supabaseUserId: string,
    assetSymbol: string
  ): Promise<CustomerAssetContext> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId
        }
      },
      select: {
        id: true,
        status: true,
        customer: {
          select: {
            id: true
          }
        }
      }
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    this.assertSensitiveVaultRequestAllowed(customerAccount.status);

    const asset = await this.prismaService.asset.findUnique({
      where: {
        chainId_symbol: {
          chainId: this.productChainId,
          symbol: assetSymbol
        }
      },
      select: {
        id: true,
        symbol: true,
        status: true
      }
    });

    if (!asset || asset.status !== AssetStatus.active) {
      throw new NotFoundException("Active asset not found for the product chain.");
    }

    return {
      customerId: customerAccount.customer.id,
      customerAccountId: customerAccount.id,
      assetId: asset.id,
      assetSymbol: asset.symbol
    };
  }

  private async requireCustomerAccountId(supabaseUserId: string): Promise<string> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId
        }
      },
      select: {
        id: true
      }
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    return customerAccount.id;
  }

  private mapRetirementVaultProjection(
    vault: RetirementVaultRecord
  ): RetirementVaultProjection {
    return {
      id: vault.id,
      customerAccountId: vault.customerAccountId,
      asset: {
        id: vault.asset.id,
        symbol: vault.asset.symbol,
        displayName: vault.asset.displayName,
        decimals: vault.asset.decimals,
        chainId: vault.asset.chainId
      },
      status: vault.status,
      strictMode: vault.strictMode,
      unlockAt: vault.unlockAt.toISOString(),
      lockedBalance: vault.lockedBalance.toString(),
      fundedAt: vault.fundedAt?.toISOString() ?? null,
      lastFundedAt: vault.lastFundedAt?.toISOString() ?? null,
      createdAt: vault.createdAt.toISOString(),
      updatedAt: vault.updatedAt.toISOString()
    };
  }

  private mapFundingIntentProjection(
    intent: RetirementVaultFundingIntentRecord
  ): RetirementVaultFundingIntentProjection {
    return {
      id: intent.id,
      retirementVaultId: intent.retirementVaultId,
      asset: {
        id: intent.asset.id,
        symbol: intent.asset.symbol,
        displayName: intent.asset.displayName,
        decimals: intent.asset.decimals,
        chainId: intent.asset.chainId
      },
      intentType: intent.intentType,
      status: intent.status,
      policyDecision: intent.policyDecision,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      idempotencyKey: intent.idempotencyKey,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString()
    };
  }

  private async findFundingIntentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<RetirementVaultFundingIntentRecord | null> {
    return this.prismaService.transactionIntent.findUnique({
      where: {
        idempotencyKey
      },
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        retirementVault: {
          select: {
            id: true
          }
        }
      }
    });
  }

  private assertReusableFundingIntent(
    existingIntent: RetirementVaultFundingIntentRecord,
    context: CustomerAssetContext,
    retirementVaultId: string,
    requestedAmount: Prisma.Decimal
  ): void {
    const matches =
      existingIntent.customerAccountId === context.customerAccountId &&
      existingIntent.intentType === TransactionIntentType.vault_subscription &&
      existingIntent.chainId === this.productChainId &&
      existingIntent.asset.symbol === context.assetSymbol &&
      existingIntent.retirementVaultId === retirementVaultId &&
      existingIntent.requestedAmount.equals(requestedAmount);

    if (!matches) {
      throw new ConflictException(
        "Idempotency key already exists for a different retirement vault funding request."
      );
    }
  }

  async listMyRetirementVaults(
    supabaseUserId: string
  ): Promise<ListMyRetirementVaultsResult> {
    const customerAccountId = await this.requireCustomerAccountId(supabaseUserId);

    const vaults = await this.prismaService.retirementVault.findMany({
      where: {
        customerAccountId
      },
      include: retirementVaultAssetInclude,
      orderBy: [
        {
          asset: {
            symbol: "asc"
          }
        },
        {
          createdAt: "asc"
        }
      ]
    });

    return {
      customerAccountId,
      vaults: vaults.map((vault) => this.mapRetirementVaultProjection(vault))
    };
  }

  async createMyRetirementVault(
    supabaseUserId: string,
    dto: CreateRetirementVaultDto
  ): Promise<CreateMyRetirementVaultResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const unlockAt = this.parseUnlockAt(dto.unlockAt);
    const strictMode = dto.strictMode ?? false;
    const context = await this.resolveCustomerAssetContext(
      supabaseUserId,
      normalizedAssetSymbol
    );

    const existingVault = await this.prismaService.retirementVault.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: context.customerAccountId,
          assetId: context.assetId
        }
      },
      include: retirementVaultAssetInclude
    });

    if (existingVault) {
      if (
        existingVault.strictMode !== strictMode ||
        existingVault.unlockAt.getTime() !== unlockAt.getTime()
      ) {
        throw new ConflictException(
          "Retirement vault already exists for this asset with different lock rules."
        );
      }

      return {
        vault: this.mapRetirementVaultProjection(existingVault),
        created: false
      };
    }

    const createdVault = await this.prismaService.$transaction(async (transaction) => {
      const vault = await transaction.retirementVault.create({
        data: {
          customerAccountId: context.customerAccountId,
          assetId: context.assetId,
          unlockAt,
          strictMode
        },
        include: retirementVaultAssetInclude
      });

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.created,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            customerAccountId: context.customerAccountId,
            assetId: context.assetId,
            assetSymbol: context.assetSymbol,
            strictMode,
            unlockAt: unlockAt.toISOString()
          }
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: context.customerId,
          actorType: "customer",
          actorId: supabaseUserId,
          action: "retirement_vault.created",
          targetType: "RetirementVault",
          targetId: vault.id,
          metadata: {
            customerAccountId: context.customerAccountId,
            assetId: context.assetId,
            assetSymbol: context.assetSymbol,
            strictMode,
            unlockAt: unlockAt.toISOString()
          }
        }
      });

      return vault;
    });

    return {
      vault: this.mapRetirementVaultProjection(createdVault),
      created: true
    };
  }

  async fundMyRetirementVault(
    supabaseUserId: string,
    dto: FundRetirementVaultDto
  ): Promise<FundMyRetirementVaultResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const requestedAmount = this.parseRequestedAmount(dto.amount);
    const context = await this.resolveCustomerAssetContext(
      supabaseUserId,
      normalizedAssetSymbol
    );

    const vault = await this.prismaService.retirementVault.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: context.customerAccountId,
          assetId: context.assetId
        }
      },
      include: retirementVaultAssetInclude
    });

    if (!vault) {
      throw new NotFoundException(
        "Retirement vault not found for the requested asset."
      );
    }

    if (vault.status !== RetirementVaultStatus.active) {
      throw new ConflictException(
        "Retirement vault is not eligible for new funding in its current state."
      );
    }

    const existingIntent = await this.findFundingIntentByIdempotencyKey(
      dto.idempotencyKey
    );

    if (existingIntent) {
      this.assertReusableFundingIntent(
        existingIntent,
        context,
        vault.id,
        requestedAmount
      );

      const latestVault = await this.prismaService.retirementVault.findUnique({
        where: {
          id: vault.id
        },
        include: retirementVaultAssetInclude
      });

      if (!latestVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        vault: this.mapRetirementVaultProjection(latestVault),
        intent: this.mapFundingIntentProjection(existingIntent),
        idempotencyReused: true
      };
    }

    const result = await this.prismaService.$transaction(async (transaction) => {
      const intent = await transaction.transactionIntent.create({
        data: {
          customerAccountId: context.customerAccountId,
          retirementVaultId: vault.id,
          assetId: context.assetId,
          chainId: this.productChainId,
          intentType: TransactionIntentType.vault_subscription,
          status: TransactionIntentStatus.settled,
          policyDecision: PolicyDecision.approved,
          requestedAmount,
          settledAmount: requestedAmount,
          idempotencyKey: dto.idempotencyKey
        },
        include: {
          asset: {
            select: {
              id: true,
              symbol: true,
              displayName: true,
              decimals: true,
              chainId: true
            }
          },
          retirementVault: {
            select: {
              id: true
            }
          }
        }
      });

      const ledgerResult = await this.ledgerService.fundRetirementVaultBalance(
        transaction,
        {
          transactionIntentId: intent.id,
          retirementVaultId: vault.id,
          customerAccountId: context.customerAccountId,
          assetId: context.assetId,
          chainId: this.productChainId,
          amount: requestedAmount
        }
      );

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.funded,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            transactionIntentId: intent.id,
            requestedAmount: requestedAmount.toString(),
            ledgerJournalId: ledgerResult.ledgerJournalId,
            availableBalanceAfter: ledgerResult.availableBalance,
            lockedBalanceAfter: ledgerResult.lockedBalance
          }
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: context.customerId,
          actorType: "customer",
          actorId: supabaseUserId,
          action: "retirement_vault.funded",
          targetType: "RetirementVault",
          targetId: vault.id,
          metadata: {
            customerAccountId: context.customerAccountId,
            assetId: context.assetId,
            assetSymbol: context.assetSymbol,
            transactionIntentId: intent.id,
            requestedAmount: requestedAmount.toString(),
            settledAmount: requestedAmount.toString(),
            ledgerJournalId: ledgerResult.ledgerJournalId,
            availableBalanceAfter: ledgerResult.availableBalance,
            lockedBalanceAfter: ledgerResult.lockedBalance,
            strictMode: vault.strictMode,
            unlockAt: vault.unlockAt.toISOString()
          }
        }
      });

      const updatedVault = await transaction.retirementVault.findUnique({
        where: {
          id: vault.id
        },
        include: retirementVaultAssetInclude
      });

      if (!updatedVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        updatedVault,
        intent
      };
    });

    return {
      vault: this.mapRetirementVaultProjection(result.updatedVault),
      intent: this.mapFundingIntentProjection(result.intent),
      idempotencyReused: false
    };
  }
}
