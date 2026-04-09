import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadStakingPoolGovernanceRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  Prisma,
  StakingPoolGovernanceRequestStatus
} from "@prisma/client";
import { assertOperatorRoleAuthorized } from "../auth/internal-operator-role-policy";
import { PrismaService } from "../prisma/prisma.service";
import { StakingService } from "./staking.service";
import { CreateStakingPoolGovernanceRequestDto } from "./dto/create-staking-pool-governance-request.dto";
import { ListStakingPoolGovernanceRequestsDto } from "./dto/list-staking-pool-governance-requests.dto";
import {
  ApproveStakingPoolGovernanceRequestDto,
  ExecuteStakingPoolGovernanceRequestDto,
  RejectStakingPoolGovernanceRequestDto
} from "./dto/staking-pool-governance-request.dto";

const stakingPoolGovernanceRequestInclude = {
  stakingPool: {
    select: {
      id: true,
      blockchainPoolId: true,
      rewardRate: true,
      poolStatus: true,
      createdAt: true,
      updatedAt: true
    }
  }
} satisfies Prisma.StakingPoolGovernanceRequestInclude;

type StakingPoolGovernanceRequestRecord =
  Prisma.StakingPoolGovernanceRequestGetPayload<{
    include: typeof stakingPoolGovernanceRequestInclude;
  }>;

type StakingPoolGovernanceRequestProjection = {
  id: string;
  rewardRate: number;
  status: StakingPoolGovernanceRequestStatus;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  executedByOperatorId: string | null;
  executedByOperatorRole: string | null;
  requestNote: string | null;
  approvalNote: string | null;
  rejectionNote: string | null;
  executionNote: string | null;
  executionFailureReason: string | null;
  blockchainTransactionHash: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stakingPool: {
    id: number;
    blockchainPoolId: number | null;
    rewardRate: number;
    poolStatus: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type StakingPoolGovernanceMutationResult = {
  request: StakingPoolGovernanceRequestProjection;
  stateReused: boolean;
};

type StakingPoolGovernanceListResult = {
  requests: StakingPoolGovernanceRequestProjection[];
  limit: number;
};

@Injectable()
export class StakingPoolGovernanceService {
  private readonly requestAllowedRoles: readonly string[];
  private readonly approverAllowedRoles: readonly string[];
  private readonly executorAllowedRoles: readonly string[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly stakingService: StakingService
  ) {
    const config = loadStakingPoolGovernanceRuntimeConfig();

    this.requestAllowedRoles = [
      ...config.stakingPoolGovernanceRequestAllowedOperatorRoles
    ];
    this.approverAllowedRoles = [
      ...config.stakingPoolGovernanceApproverAllowedOperatorRoles
    ];
    this.executorAllowedRoles = [
      ...config.stakingPoolGovernanceExecutorAllowedOperatorRoles
    ];
  }

  private normalizeOptionalString(value?: string): string | null {
    const normalizedValue = value?.trim() ?? null;

    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  }

  private assertCanRequest(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.requestAllowedRoles,
      "Operator role is not authorized to request staking pool governance changes."
    );
  }

  private assertCanApprove(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.approverAllowedRoles,
      "Operator role is not authorized to approve or reject staking pool governance changes."
    );
  }

  private assertCanExecute(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.executorAllowedRoles,
      "Operator role is not authorized to execute approved staking pool governance changes."
    );
  }

  private mapProjection(
    request: StakingPoolGovernanceRequestRecord
  ): StakingPoolGovernanceRequestProjection {
    return {
      id: request.id,
      rewardRate: request.rewardRate,
      status: request.status,
      requestedByOperatorId: request.requestedByOperatorId,
      requestedByOperatorRole: request.requestedByOperatorRole ?? null,
      approvedByOperatorId: request.approvedByOperatorId ?? null,
      approvedByOperatorRole: request.approvedByOperatorRole ?? null,
      rejectedByOperatorId: request.rejectedByOperatorId ?? null,
      rejectedByOperatorRole: request.rejectedByOperatorRole ?? null,
      executedByOperatorId: request.executedByOperatorId ?? null,
      executedByOperatorRole: request.executedByOperatorRole ?? null,
      requestNote: request.requestNote ?? null,
      approvalNote: request.approvalNote ?? null,
      rejectionNote: request.rejectionNote ?? null,
      executionNote: request.executionNote ?? null,
      executionFailureReason: request.executionFailureReason ?? null,
      blockchainTransactionHash: request.blockchainTransactionHash ?? null,
      requestedAt: request.requestedAt.toISOString(),
      approvedAt: request.approvedAt?.toISOString() ?? null,
      rejectedAt: request.rejectedAt?.toISOString() ?? null,
      executedAt: request.executedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      stakingPool: request.stakingPool
        ? {
            id: request.stakingPool.id,
            blockchainPoolId: request.stakingPool.blockchainPoolId,
            rewardRate: request.stakingPool.rewardRate,
            poolStatus: request.stakingPool.poolStatus,
            createdAt: request.stakingPool.createdAt.toISOString(),
            updatedAt: request.stakingPool.updatedAt.toISOString()
          }
        : null
    };
  }

  private async findRequestById(
    requestId: string
  ): Promise<StakingPoolGovernanceRequestRecord | null> {
    return this.prismaService.stakingPoolGovernanceRequest.findUnique({
      where: {
        id: requestId
      },
      include: stakingPoolGovernanceRequestInclude
    });
  }

  async createRequest(
    dto: CreateStakingPoolGovernanceRequestDto,
    operatorId: string,
    operatorRole?: string
  ): Promise<StakingPoolGovernanceMutationResult> {
    const normalizedOperatorRole = this.assertCanRequest(operatorRole);
    const requestNote = this.normalizeOptionalString(dto.requestNote);

    const request = await this.prismaService.$transaction(async (transaction) => {
      const createdRequest = await transaction.stakingPoolGovernanceRequest.create({
        data: {
          rewardRate: dto.rewardRate,
          requestedByOperatorId: operatorId,
          requestedByOperatorRole: normalizedOperatorRole,
          requestNote: requestNote ?? undefined
        },
        include: stakingPoolGovernanceRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operatorId,
          action: "staking.pool_creation.requested",
          targetType: "StakingPoolGovernanceRequest",
          targetId: createdRequest.id,
          metadata: {
            rewardRate: dto.rewardRate,
            requestNote,
            operatorRole: normalizedOperatorRole
          } as Prisma.InputJsonValue
        }
      });

      return createdRequest;
    });

    return {
      request: this.mapProjection(request),
      stateReused: false
    };
  }

  async listRequests(
    query: ListStakingPoolGovernanceRequestsDto
  ): Promise<StakingPoolGovernanceListResult> {
    const limit = query.limit ?? 20;
    const requests = await this.prismaService.stakingPoolGovernanceRequest.findMany({
      where: query.status
        ? {
            status: query.status
          }
        : undefined,
      include: stakingPoolGovernanceRequestInclude,
      orderBy: {
        requestedAt: "desc"
      },
      take: limit
    });

    return {
      requests: requests.map((request) => this.mapProjection(request)),
      limit
    };
  }

  async getRequest(
    requestId: string
  ): Promise<StakingPoolGovernanceMutationResult> {
    const request = await this.findRequestById(requestId);

    if (!request) {
      throw new NotFoundException("Staking pool governance request was not found.");
    }

    return {
      request: this.mapProjection(request),
      stateReused: false
    };
  }

  async approveRequest(
    requestId: string,
    dto: ApproveStakingPoolGovernanceRequestDto,
    operatorId: string,
    operatorRole?: string
  ): Promise<StakingPoolGovernanceMutationResult> {
    const approvedOperatorRole = this.assertCanApprove(operatorRole);
    const request = await this.findRequestById(requestId);

    if (!request) {
      throw new NotFoundException("Staking pool governance request was not found.");
    }

    if (request.status !== StakingPoolGovernanceRequestStatus.pending_approval) {
      throw new ConflictException(
        "Only pending staking pool governance requests can be approved."
      );
    }

    if (request.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Staking pool governance requests require a different approver than the requester."
      );
    }

    const approvalNote = this.normalizeOptionalString(dto.approvalNote);

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest = await transaction.stakingPoolGovernanceRequest.update({
          where: {
            id: request.id
          },
          data: {
            status: StakingPoolGovernanceRequestStatus.approved,
            approvedByOperatorId: operatorId,
            approvedByOperatorRole: approvedOperatorRole,
            approvalNote: approvalNote ?? undefined,
            approvedAt: new Date()
          },
          include: stakingPoolGovernanceRequestInclude
        });

        await transaction.auditEvent.create({
          data: {
            customerId: null,
            actorType: "operator",
            actorId: operatorId,
            action: "staking.pool_creation.approved",
            targetType: "StakingPoolGovernanceRequest",
            targetId: nextRequest.id,
            metadata: {
              rewardRate: nextRequest.rewardRate,
              approvedByOperatorRole: approvedOperatorRole,
              approvalNote
            } as Prisma.InputJsonValue
          }
        });

        return nextRequest;
      }
    );

    return {
      request: this.mapProjection(updatedRequest),
      stateReused: false
    };
  }

  async rejectRequest(
    requestId: string,
    dto: RejectStakingPoolGovernanceRequestDto,
    operatorId: string,
    operatorRole?: string
  ): Promise<StakingPoolGovernanceMutationResult> {
    const rejectedOperatorRole = this.assertCanApprove(operatorRole);
    const request = await this.findRequestById(requestId);

    if (!request) {
      throw new NotFoundException("Staking pool governance request was not found.");
    }

    if (request.status !== StakingPoolGovernanceRequestStatus.pending_approval) {
      throw new ConflictException(
        "Only pending staking pool governance requests can be rejected."
      );
    }

    const rejectionNote = dto.rejectionNote.trim();

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest = await transaction.stakingPoolGovernanceRequest.update({
          where: {
            id: request.id
          },
          data: {
            status: StakingPoolGovernanceRequestStatus.rejected,
            rejectedByOperatorId: operatorId,
            rejectedByOperatorRole: rejectedOperatorRole,
            rejectionNote,
            rejectedAt: new Date()
          },
          include: stakingPoolGovernanceRequestInclude
        });

        await transaction.auditEvent.create({
          data: {
            customerId: null,
            actorType: "operator",
            actorId: operatorId,
            action: "staking.pool_creation.rejected",
            targetType: "StakingPoolGovernanceRequest",
            targetId: nextRequest.id,
            metadata: {
              rewardRate: nextRequest.rewardRate,
              rejectedByOperatorRole: rejectedOperatorRole,
              rejectionNote
            } as Prisma.InputJsonValue
          }
        });

        return nextRequest;
      }
    );

    return {
      request: this.mapProjection(updatedRequest),
      stateReused: false
    };
  }

  async executeRequest(
    requestId: string,
    dto: ExecuteStakingPoolGovernanceRequestDto,
    operatorId: string,
    operatorRole?: string
  ): Promise<StakingPoolGovernanceMutationResult> {
    const executedOperatorRole = this.assertCanExecute(operatorRole);
    const request = await this.findRequestById(requestId);

    if (!request) {
      throw new NotFoundException("Staking pool governance request was not found.");
    }

    if (request.status === StakingPoolGovernanceRequestStatus.executed) {
      return {
        request: this.mapProjection(request),
        stateReused: true
      };
    }

    if (
      request.status !== StakingPoolGovernanceRequestStatus.approved &&
      request.status !== StakingPoolGovernanceRequestStatus.execution_failed
    ) {
      throw new ConflictException(
        "Only approved or retryable staking pool governance requests can be executed."
      );
    }

    const executionNote = this.normalizeOptionalString(dto.executionNote);
    const executionResult = await this.stakingService.executeGovernedPoolCreation({
      rewardRate: request.rewardRate,
      operatorId,
      operatorRole: executedOperatorRole,
      stakingPoolId: request.stakingPoolId
    });

    if (!executionResult.success) {
      const failedRequest = await this.prismaService.$transaction(
        async (transaction) => {
          const nextRequest = await transaction.stakingPoolGovernanceRequest.update({
            where: {
              id: request.id
            },
            data: {
              status: StakingPoolGovernanceRequestStatus.execution_failed,
              executionNote: executionNote ?? undefined,
              executionFailureReason: executionResult.errorMessage,
              blockchainTransactionHash:
                executionResult.transactionHash ?? undefined,
              stakingPoolId: executionResult.poolId
            },
            include: stakingPoolGovernanceRequestInclude
          });

          await transaction.auditEvent.create({
            data: {
              customerId: null,
              actorType: "operator",
              actorId: operatorId,
              action: "staking.pool_creation.execution_failed",
              targetType: "StakingPoolGovernanceRequest",
              targetId: nextRequest.id,
              metadata: {
                rewardRate: nextRequest.rewardRate,
                executedByOperatorRole: executedOperatorRole,
                executionNote,
                executionFailureReason: executionResult.errorMessage,
                stakingPoolId: executionResult.poolId,
                blockchainPoolId: executionResult.blockchainPoolId,
                transactionHash: executionResult.transactionHash,
                retryAttempt:
                  request.status ===
                  StakingPoolGovernanceRequestStatus.execution_failed
              } as Prisma.InputJsonValue
            }
          });

          return nextRequest;
        }
      );

      return {
        request: this.mapProjection(failedRequest),
        stateReused: false
      };
    }

    const executedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest = await transaction.stakingPoolGovernanceRequest.update({
          where: {
            id: request.id
          },
          data: {
            status: StakingPoolGovernanceRequestStatus.executed,
            executedByOperatorId: operatorId,
            executedByOperatorRole: executedOperatorRole,
            executionNote: executionNote ?? undefined,
            executionFailureReason: null,
            blockchainTransactionHash: executionResult.transactionHash,
            stakingPoolId: executionResult.poolId,
            executedAt: new Date()
          },
          include: stakingPoolGovernanceRequestInclude
        });

        await transaction.auditEvent.create({
          data: {
            customerId: null,
            actorType: "operator",
            actorId: operatorId,
            action: "staking.pool_creation.executed",
            targetType: "StakingPoolGovernanceRequest",
            targetId: nextRequest.id,
            metadata: {
              rewardRate: nextRequest.rewardRate,
              executedByOperatorRole: executedOperatorRole,
              executionNote,
              stakingPoolId: executionResult.poolId,
              blockchainPoolId: executionResult.blockchainPoolId,
              transactionHash: executionResult.transactionHash,
              retryAttempt:
                request.status ===
                StakingPoolGovernanceRequestStatus.execution_failed
            } as Prisma.InputJsonValue
          }
        });

        return nextRequest;
      }
    );

    return {
      request: this.mapProjection(executedRequest),
      stateReused: false
    };
  }
}
