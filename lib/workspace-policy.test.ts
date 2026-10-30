import assert from "node:assert/strict";
import test from "node:test";
import { OrganizationRole } from "@prisma/client";
import {
  canEditBrandProfile,
  canInviteRole,
  normalizeInvitationEmail,
} from "./workspace-policy";

test("normalizes invitation emails before persistence", () => {
  assert.equal(normalizeInvitationEmail("  NEWS@Example.COM "), "news@example.com");
});

test("rejects malformed, blank, non-string and oversized invitation emails", () => {
  assert.equal(normalizeInvitationEmail(""), null);
  assert.equal(normalizeInvitationEmail("not-an-email"), null);
  assert.equal(normalizeInvitationEmail("name @example.com"), null);
  assert.equal(normalizeInvitationEmail(42), null);
  assert.equal(normalizeInvitationEmail(`${"a".repeat(245)}@example.com`), null);
});

test("owners may invite every non-owner workspace role", () => {
  assert.equal(canInviteRole(OrganizationRole.OWNER, OrganizationRole.ADMIN), true);
  assert.equal(canInviteRole(OrganizationRole.OWNER, OrganizationRole.EDITOR), true);
  assert.equal(canInviteRole(OrganizationRole.OWNER, OrganizationRole.REVIEWER), true);
  assert.equal(canInviteRole(OrganizationRole.OWNER, OrganizationRole.VIEWER), true);
  assert.equal(canInviteRole(OrganizationRole.OWNER, OrganizationRole.OWNER), false);
});

test("admins may invite non-admin roles but cannot grant admin access", () => {
  assert.equal(canInviteRole(OrganizationRole.ADMIN, OrganizationRole.ADMIN), false);
  assert.equal(canInviteRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR), true);
  assert.equal(canInviteRole(OrganizationRole.ADMIN, OrganizationRole.REVIEWER), true);
  assert.equal(canInviteRole(OrganizationRole.ADMIN, OrganizationRole.VIEWER), true);
});

test("editors, reviewers and viewers cannot invite team members", () => {
  for (const role of [OrganizationRole.EDITOR, OrganizationRole.REVIEWER, OrganizationRole.VIEWER]) {
    assert.equal(canInviteRole(role, OrganizationRole.EDITOR), false);
  }
});

test("only owners, admins and editors may update brand profiles", () => {
  assert.equal(canEditBrandProfile(OrganizationRole.OWNER), true);
  assert.equal(canEditBrandProfile(OrganizationRole.ADMIN), true);
  assert.equal(canEditBrandProfile(OrganizationRole.EDITOR), true);
  assert.equal(canEditBrandProfile(OrganizationRole.REVIEWER), false);
  assert.equal(canEditBrandProfile(OrganizationRole.VIEWER), false);
});
