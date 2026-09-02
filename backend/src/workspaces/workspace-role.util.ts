import { WorkspaceRole } from '@prisma/client';

/**
 * OWNER outranks ADMIN but should be treated as an admin everywhere
 * "is this user an admin" is checked (visibility, write access, member
 * management, etc). Use this instead of a bare `=== WorkspaceRole.ADMIN`
 * comparison so OWNER isn't silently excluded.
 */
export function isAdminRole(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER;
}
