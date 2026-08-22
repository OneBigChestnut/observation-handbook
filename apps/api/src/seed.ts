import { eq } from "drizzle-orm";
import type { AppDatabase } from "./db/client.js";
import { accounts, children, families, familyMemberships } from "./db/schema.js";
import { hashPassword } from "./password.js";

const developmentPassword = "correct-horse-battery-staple";
const familyId = "family-lin";

export async function seedDevelopmentData(database: AppDatabase): Promise<string> {
  const createdAt = new Date();
  const admin = await ensureAccount(database, "account-lin", "lin", "super_admin");
  const reader = await ensureAccount(database, "account-zhou", "zhou", null);
  const family = await database.query.families.findFirst({ where: eq(families.id, familyId) });
  if (!family) await database.insert(families).values({ id: familyId, name: "林家档案室", createdAt });

  await database.insert(familyMemberships).values([
    { accountId: admin.id, familyId, role: "admin" },
    { accountId: reader.id, familyId, role: "reader" },
  ]).onConflictDoNothing();
  await database.insert(children).values([
    { id: "child-lele", familyId, name: "乐乐", createdAt },
    { id: "child-anan", familyId, name: "安安", createdAt },
  ]).onConflictDoNothing();
  return familyId;
}

async function ensureAccount(database: AppDatabase, id: string, username: string, platformRole: "super_admin" | null) {
  const existing = await database.query.accounts.findFirst({ where: eq(accounts.username, username) });
  if (existing) return existing;
  const account = { id, username, passwordHash: await hashPassword(developmentPassword), platformRole, createdAt: new Date() };
  await database.insert(accounts).values(account);
  return account;
}
