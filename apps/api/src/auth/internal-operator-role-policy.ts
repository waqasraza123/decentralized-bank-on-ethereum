import { ForbiddenException } from "@nestjs/common";

export function normalizeOperatorRole(
  operatorRole?: string | null
): string | null {
  const normalizedOperatorRole = operatorRole?.trim().toLowerCase() ?? null;

  return normalizedOperatorRole && normalizedOperatorRole.length > 0
    ? normalizedOperatorRole
    : null;
}

export function assertOperatorRoleAuthorized(
  operatorRole: string | undefined | null,
  allowedOperatorRoles: readonly string[],
  message: string
): string {
  const normalizedOperatorRole = normalizeOperatorRole(operatorRole);

  if (
    !normalizedOperatorRole ||
    !allowedOperatorRoles.includes(normalizedOperatorRole)
  ) {
    throw new ForbiddenException(message);
  }

  return normalizedOperatorRole;
}
