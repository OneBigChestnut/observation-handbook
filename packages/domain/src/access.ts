export type FamilyScopedActor = {
  platformRole?: "super_admin" | "operations_admin" | null;
  memberships: Array<{ familyId: string; role: "admin" | "reader" }>;
  /** A child account is deliberately scoped to one archive, never a family. */
  childId?: string | null;
};

export type FamilyScopedChild = {
  id: string;
  familyId: string;
};

export type FamilyMembershipRole = { accountId: string; role: "admin" | "reader" };

export function assertFamilyRoleChange(current: FamilyMembershipRole[], nextMembership: FamilyMembershipRole): void {
  const next = [
    ...current.filter(membership => membership.accountId !== nextMembership.accountId),
    nextMembership,
  ];
  if (next.filter(membership => membership.role === "admin").length !== 1) {
    throw new Error("FAMILY_ADMIN_REQUIRED");
  }
}

export function requireFamilyRead(actor: FamilyScopedActor, familyId: string): void {
  if (actor.platformRole === "super_admin") return;
  if (!actor.memberships.some(membership => membership.familyId === familyId)) {
    throw new Error("FAMILY_ACCESS_DENIED");
  }
}

export function requireFamilyAdmin(actor: FamilyScopedActor, familyId: string): void {
  if (actor.platformRole === "super_admin") return;
  if (!actor.memberships.some(membership => membership.familyId === familyId && membership.role === "admin")) {
    throw new Error("FAMILY_ADMIN_REQUIRED");
  }
}

export function requireChildAccess(actor: FamilyScopedActor, child: FamilyScopedChild): void {
  if (actor.childId === child.id) return;
  requireFamilyRead(actor, child.familyId);
}

export function requireChildEdit(actor: FamilyScopedActor, child: FamilyScopedChild): void {
  if (actor.childId === child.id) return;
  requireFamilyAdmin(actor, child.familyId);
}
