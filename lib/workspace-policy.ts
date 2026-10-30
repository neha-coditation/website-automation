import { OrganizationRole } from "@prisma/client";

const INVITABLE_ROLES = new Set<OrganizationRole>([
  OrganizationRole.ADMIN,
  OrganizationRole.EDITOR,
  OrganizationRole.REVIEWER,
  OrganizationRole.VIEWER,
]);

export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function canInviteRole(actorRole: OrganizationRole, invitedRole: unknown): invitedRole is OrganizationRole {
  if (!INVITABLE_ROLES.has(invitedRole as OrganizationRole)) return false;
  if (actorRole === OrganizationRole.OWNER) return true;
  return actorRole === OrganizationRole.ADMIN && invitedRole !== OrganizationRole.ADMIN;
}

export function canEditBrandProfile(role: OrganizationRole): boolean {
  return role === OrganizationRole.OWNER
    || role === OrganizationRole.ADMIN
    || role === OrganizationRole.EDITOR;
}
