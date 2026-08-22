import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  platformRole: text("platform_role", { enum: ["super_admin", "operations_admin"] }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("accounts_username_unique").on(table.username)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash), index("sessions_account_expiry_index").on(table.accountId, table.expiresAt)]);

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const familyMemberships = sqliteTable("family_memberships", {
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "reader"] }).notNull(),
}, table => [primaryKey({ columns: [table.accountId, table.familyId] }), index("family_memberships_family_role_index").on(table.familyId, table.role)]);

export const children = sqliteTable("children", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("children_family_name_unique").on(table.familyId, table.name)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => accounts.id, { onDelete: "set null" }),
  familyId: text("family_id").references(() => families.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  metadata: text("metadata").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [index("audit_logs_family_created_index").on(table.familyId, table.createdAt), index("audit_logs_actor_created_index").on(table.actorId, table.createdAt)]);
