import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import type { AppDatabase } from "./db/client.js";
import { accounts, familyMemberships, sessions } from "./db/schema.js";

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1_000;

export type RequestActor = {
  accountId: string;
  username: string;
  platformRole: "super_admin" | "operations_admin" | null;
  memberships: Array<{ familyId: string; role: "admin" | "reader" }>;
};

export async function createSession(database: AppDatabase, accountId: string, now = new Date()): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs);

  await database.insert(sessions).values({
    id: randomBytes(16).toString("base64url"),
    tokenHash: hashSessionToken(rawToken),
    accountId,
    expiresAt,
    createdAt: now,
  });

  return { rawToken, expiresAt };
}

export async function getActorFromToken(database: AppDatabase, rawToken: string, now = new Date()): Promise<RequestActor | null> {
  const session = await database.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, hashSessionToken(rawToken)), gt(sessions.expiresAt, now)),
  });
  if (!session) return null;

  const account = await database.query.accounts.findFirst({ where: eq(accounts.id, session.accountId) });
  if (!account) return null;

  const memberships = await database.select({ familyId: familyMemberships.familyId, role: familyMemberships.role })
    .from(familyMemberships)
    .where(eq(familyMemberships.accountId, account.id));

  return {
    accountId: account.id,
    username: account.username,
    platformRole: account.platformRole,
    memberships,
  };
}

export async function removeSession(database: AppDatabase, rawToken: string): Promise<void> {
  await database.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(rawToken)));
}

export async function removeOtherSessions(database: AppDatabase, accountId: string, currentRawToken: string): Promise<void> {
  await database.delete(sessions).where(and(
    eq(sessions.accountId, accountId),
    ne(sessions.tokenHash, hashSessionToken(currentRawToken)),
  ));
}

function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
