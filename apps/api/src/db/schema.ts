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

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  childId: text("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  originalPath: text("original_path").notNull(),
  thumbnailPath: text("thumbnail_path").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [index("media_assets_child_created_index").on(table.childId, table.createdAt)]);

export const observationCards = sqliteTable("observation_cards", {
  id: text("id").primaryKey(),
  childId: text("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  observedAt: text("observed_at").notNull(),
  text: text("text").notNull(),
  state: text("state", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, table => [index("observation_cards_child_observed_index").on(table.childId, table.observedAt)]);

export const cardPhotos = sqliteTable("card_photos", {
  cardId: text("card_id").notNull().references(() => observationCards.id, { onDelete: "cascade" }),
  mediaAssetId: text("media_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
}, table => [primaryKey({ columns: [table.cardId, table.mediaAssetId] }), uniqueIndex("card_photos_card_position_unique").on(table.cardId, table.position)]);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  childId: text("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("tags_child_name_unique").on(table.childId, table.name), index("tags_child_created_index").on(table.childId, table.createdAt)]);

export const cardTags = sqliteTable("card_tags", {
  cardId: text("card_id").notNull().references(() => observationCards.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, table => [primaryKey({ columns: [table.cardId, table.tagId] })]);

export const handbooks = sqliteTable("handbooks", {
  id: text("id").primaryKey(),
  childId: text("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  introduction: text("introduction").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  visibility: text("visibility", { enum: ["family", "public"] }).notNull().default("family"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, table => [index("handbooks_child_updated_index").on(table.childId, table.updatedAt)]);

export const handbookCards = sqliteTable("handbook_cards", {
  handbookId: text("handbook_id").notNull().references(() => handbooks.id, { onDelete: "cascade" }),
  cardId: text("card_id").notNull().references(() => observationCards.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
}, table => [primaryKey({ columns: [table.handbookId, table.cardId] }), uniqueIndex("handbook_cards_handbook_position_unique").on(table.handbookId, table.position)]);

export const handbookTags = sqliteTable("handbook_tags", {
  handbookId: text("handbook_id").notNull().references(() => handbooks.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, table => [primaryKey({ columns: [table.handbookId, table.tagId] })]);

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

export const templateVersions = sqliteTable("template_versions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["cover", "back", "card_1", "card_2", "card_3", "card_4"] }).notNull(),
  state: text("state", { enum: ["draft", "published", "retired"] }).notNull().default("draft"),
  paperSize: text("paper_size", { enum: ["A5"] }).notNull().default("A5"),
  orientation: text("orientation", { enum: ["portrait"] }).notNull().default("portrait"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, table => [index("template_versions_kind_state_index").on(table.kind, table.state)]);

export const templateUsages = sqliteTable("template_usages", {
  id: text("id").primaryKey(),
  templateVersionId: text("template_version_id").notNull().references(() => templateVersions.id, { onDelete: "restrict" }),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [index("template_usages_template_index").on(table.templateVersionId)]);

export const exportJobs = sqliteTable("export_jobs", {
  id: text("id").primaryKey(), childId: text("child_id").notNull().references(() => children.id, { onDelete: "cascade" }), handbookId: text("handbook_id").notNull().references(() => handbooks.id, { onDelete: "restrict" }), kind: text("kind", { enum: ["screen", "print"] }).notNull(), snapshot: text("snapshot").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [index("export_jobs_child_created_index").on(table.childId, table.createdAt)]);
