import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditEventsService } from "./audit-events.service";

function buildAuditEventRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "audit_1",
    customerId: "customer_1",
    actorType: "operator",
    actorId: "ops_1",
    action: "review_case.started",
    targetType: "ReviewCase",
    targetId: "review_1",
    metadata: {
      reviewCaseId: "review_1"
    },
    createdAt: new Date("2026-04-06T10:00:00.000Z"),
    customer: {
      id: "customer_1",
      supabaseUserId: "user_1",
      email: "risk@example.com",
      firstName: "Risk",
      lastName: "Owner"
    },
    ...overrides
  };
}

function createService() {
  const prismaService = {
    auditEvent: {
      findMany: jest.fn(),
      count: jest.fn()
    }
  } as unknown as PrismaService;

  return {
    prismaService,
    service: new AuditEventsService(prismaService)
  };
}

describe("AuditEventsService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lists audit events with production filters and customer context", async () => {
    const { service, prismaService } = createService();

    (prismaService.auditEvent.findMany as jest.Mock).mockResolvedValue([
      buildAuditEventRecord()
    ]);
    (prismaService.auditEvent.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listAuditEvents({
      limit: 5,
      search: "review_1",
      actorType: "operator",
      action: "review_case.",
      targetType: "ReviewCase",
      dateFrom: "2026-04-06T00:00:00.000Z",
      dateTo: "2026-04-07T00:00:00.000Z"
    });

    expect(prismaService.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        orderBy: {
          createdAt: "desc"
        },
        include: expect.any(Object),
        where: {
          AND: expect.arrayContaining([
            {
              actorType: "operator"
            },
            {
              action: {
                startsWith: "review_case.",
                mode: "insensitive"
              }
            },
            {
              targetType: "ReviewCase"
            },
            {
              createdAt: {
                gte: new Date("2026-04-06T00:00:00.000Z"),
                lte: new Date("2026-04-07T00:00:00.000Z")
              }
            },
            {
              OR: expect.arrayContaining([
                {
                  action: {
                    contains: "review_1",
                    mode: "insensitive"
                  }
                },
                {
                  targetId: {
                    contains: "review_1",
                    mode: "insensitive"
                  }
                }
              ])
            }
          ])
        }
      })
    );
    expect(result.totalCount).toBe(1);
    expect(result.events[0]).toEqual({
      id: "audit_1",
      actorType: "operator",
      actorId: "ops_1",
      action: "review_case.started",
      targetType: "ReviewCase",
      targetId: "review_1",
      metadata: {
        reviewCaseId: "review_1"
      },
      createdAt: "2026-04-06T10:00:00.000Z",
      customer: {
        customerId: "customer_1",
        supabaseUserId: "user_1",
        email: "risk@example.com",
        firstName: "Risk",
        lastName: "Owner"
      }
    });
  });

  it("rejects an invalid date range", async () => {
    const { service } = createService();

    await expect(
      service.listAuditEvents({
        dateFrom: "2026-04-07T00:00:00.000Z",
        dateTo: "2026-04-06T00:00:00.000Z"
      })
    ).rejects.toThrow(BadRequestException);
  });
});
