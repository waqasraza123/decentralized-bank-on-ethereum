import {
  BadRequestException,
  Injectable
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListAuditEventsDto } from "./dto/list-audit-events.dto";

const auditEventInclude = {
  customer: {
    select: {
      id: true,
      supabaseUserId: true,
      email: true,
      firstName: true,
      lastName: true
    }
  }
} satisfies Prisma.AuditEventInclude;

type AuditEventRecord = Prisma.AuditEventGetPayload<{
  include: typeof auditEventInclude;
}>;

type AuditEventProjection = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
  customer: {
    customerId: string;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type ListAuditEventsResult = {
  events: AuditEventProjection[];
  limit: number;
  totalCount: number;
  filters: {
    search: string | null;
    customerId: string | null;
    email: string | null;
    actorType: string | null;
    actorId: string | null;
    action: string | null;
    targetType: string | null;
    targetId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
};

function trimOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

@Injectable()
export class AuditEventsService {
  constructor(private readonly prismaService: PrismaService) {}

  private parseOptionalDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Invalid audit event date filter.");
    }

    return parsed;
  }

  private assertDateRange(dateFrom: Date | null, dateTo: Date | null): void {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException("dateFrom must be before or equal to dateTo.");
    }
  }

  private buildSearchFilter(search: string): Prisma.AuditEventWhereInput {
    return {
      OR: [
        {
          actorId: {
            contains: search,
            mode: Prisma.QueryMode.insensitive
          }
        },
        {
          action: {
            contains: search,
            mode: Prisma.QueryMode.insensitive
          }
        },
        {
          targetType: {
            contains: search,
            mode: Prisma.QueryMode.insensitive
          }
        },
        {
          targetId: {
            contains: search,
            mode: Prisma.QueryMode.insensitive
          }
        },
        {
          customerId: {
            equals: search
          }
        },
        {
          customer: {
            email: {
              contains: search,
              mode: Prisma.QueryMode.insensitive
            }
          }
        },
        {
          customer: {
            supabaseUserId: {
              contains: search,
              mode: Prisma.QueryMode.insensitive
            }
          }
        },
        {
          customer: {
            firstName: {
              contains: search,
              mode: Prisma.QueryMode.insensitive
            }
          }
        },
        {
          customer: {
            lastName: {
              contains: search,
              mode: Prisma.QueryMode.insensitive
            }
          }
        }
      ]
    };
  }

  private buildWhere(query: ListAuditEventsDto): {
    where: Prisma.AuditEventWhereInput;
    filters: ListAuditEventsResult["filters"];
  } {
    const search = trimOptional(query.search);
    const customerId = trimOptional(query.customerId);
    const email = trimOptional(query.email);
    const actorType = trimOptional(query.actorType);
    const actorId = trimOptional(query.actorId);
    const action = trimOptional(query.action);
    const targetType = trimOptional(query.targetType);
    const targetId = trimOptional(query.targetId);
    const dateFrom = this.parseOptionalDate(query.dateFrom);
    const dateTo = this.parseOptionalDate(query.dateTo);

    this.assertDateRange(dateFrom, dateTo);

    const filters: Prisma.AuditEventWhereInput[] = [];

    if (customerId) {
      filters.push({
        customerId
      });
    }

    if (email) {
      filters.push({
        customer: {
          email: {
            contains: email,
            mode: Prisma.QueryMode.insensitive
          }
        }
      });
    }

    if (actorType) {
      filters.push({
        actorType
      });
    }

    if (actorId) {
      filters.push({
        actorId: {
          contains: actorId,
          mode: Prisma.QueryMode.insensitive
        }
      });
    }

    if (action) {
      filters.push({
        action: {
          startsWith: action,
          mode: Prisma.QueryMode.insensitive
        }
      });
    }

    if (targetType) {
      filters.push({
        targetType
      });
    }

    if (targetId) {
      filters.push({
        targetId: {
          contains: targetId,
          mode: Prisma.QueryMode.insensitive
        }
      });
    }

    if (dateFrom || dateTo) {
      filters.push({
        createdAt: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {})
        }
      });
    }

    if (search) {
      filters.push(this.buildSearchFilter(search));
    }

    return {
      where:
        filters.length === 0
          ? {}
          : filters.length === 1
            ? filters[0]
            : {
                AND: filters
              },
      filters: {
        search: search ?? null,
        customerId: customerId ?? null,
        email: email ?? null,
        actorType: actorType ?? null,
        actorId: actorId ?? null,
        action: action ?? null,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        dateFrom: dateFrom?.toISOString() ?? null,
        dateTo: dateTo?.toISOString() ?? null
      }
    };
  }

  private mapAuditEvent(record: AuditEventRecord): AuditEventProjection {
    return {
      id: record.id,
      actorType: record.actorType,
      actorId: record.actorId ?? null,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId ?? null,
      metadata: record.metadata ?? null,
      createdAt: record.createdAt.toISOString(),
      customer: record.customer
        ? {
            customerId: record.customer.id,
            supabaseUserId: record.customer.supabaseUserId ?? null,
            email: record.customer.email ?? null,
            firstName: record.customer.firstName,
            lastName: record.customer.lastName
          }
        : null
    };
  }

  async listAuditEvents(
    query: ListAuditEventsDto
  ): Promise<ListAuditEventsResult> {
    const limit = query.limit ?? 25;
    const { where, filters } = this.buildWhere(query);

    const [events, totalCount] = await Promise.all([
      this.prismaService.auditEvent.findMany({
        where,
        take: limit,
        orderBy: {
          createdAt: "desc"
        },
        include: auditEventInclude
      }),
      this.prismaService.auditEvent.count({
        where
      })
    ]);

    return {
      events: events.map((event) => this.mapAuditEvent(event)),
      limit,
      totalCount,
      filters
    };
  }
}
