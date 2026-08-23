import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { auditLogs, templateUsages, templateVersions } from "../db/schema.js";

type Options = { database: AppDatabase; config: ApiConfig };
type Kind = "cover" | "back" | "card_1" | "card_2" | "card_3" | "card_4";
type State = "draft" | "published" | "retired";
const kinds: Kind[] = ["cover", "back", "card_1", "card_2", "card_3", "card_4"];
const states: State[] = ["draft", "published", "retired"];

export const registerTemplateRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get<{ Querystring: { kind?: string } }>("/api/templates", async (request, reply) => {
    const actor = await actorFor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (request.query.kind && !kinds.includes(request.query.kind as Kind)) return reply.code(400).send({ code: "TEMPLATE_KIND_INVALID" });
    const where = request.query.kind ? and(eq(templateVersions.state, "published"), eq(templateVersions.kind, request.query.kind as Kind)) : eq(templateVersions.state, "published");
    return { templates: (await options.database.select().from(templateVersions).where(where)).map(templateResponse) };
  });
  app.get("/api/admin/templates", async (request, reply) => {
    const actor = await actorFor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (actor.platformRole !== "super_admin") return reply.code(403).send({ code: "SUPER_ADMIN_REQUIRED" });
    return { templates: (await options.database.select().from(templateVersions)).map(templateResponse) };
  });
  app.post<{ Body: { name?: string; kind?: string; state?: string } }>("/api/admin/templates", async (request, reply) => {
    const actor = await actorFor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (actor.platformRole !== "super_admin") return reply.code(403).send({ code: "SUPER_ADMIN_REQUIRED" });
    const name = request.body.name?.trim(); const kind = request.body.kind as Kind; const state = (request.body.state ?? "draft") as State;
    if (!name || !kinds.includes(kind) || !states.includes(state)) return reply.code(400).send({ code: "TEMPLATE_DETAILS_INVALID" });
    const now = new Date(); const template = { id: randomUUID(), name, kind, state, paperSize: "A5" as const, orientation: "portrait" as const, createdAt: now, updatedAt: now };
    await options.database.insert(templateVersions).values(template);
    await options.database.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: null, action: "template.created", targetType: "template", targetId: template.id, metadata: "{}", createdAt: now });
    return reply.code(201).send({ template: templateResponse(template) });
  });
  app.patch<{ Params: { templateId: string }; Body: { name?: string; state?: string } }>("/api/admin/templates/:templateId", async (request, reply) => {
    const actor = await actorFor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" }); if (actor.platformRole !== "super_admin") return reply.code(403).send({ code: "SUPER_ADMIN_REQUIRED" });
    const template = await options.database.query.templateVersions.findFirst({ where: eq(templateVersions.id, request.params.templateId) }); if (!template) return reply.code(404).send({ code: "TEMPLATE_NOT_FOUND" });
    const usage = await usageCount(options.database, template.id); if (usage) return reply.code(409).send({ code: "TEMPLATE_IMMUTABLE", usageCount: usage });
    const state = request.body.state as State | undefined; if (state && !states.includes(state)) return reply.code(400).send({ code: "TEMPLATE_STATE_INVALID" });
    const next = { ...template, name: request.body.name?.trim() || template.name, state: state ?? template.state, updatedAt: new Date() };
    await options.database.update(templateVersions).set({ name: next.name, state: next.state, updatedAt: next.updatedAt }).where(eq(templateVersions.id, template.id));
    return { template: templateResponse(next) };
  });
  app.delete<{ Params: { templateId: string } }>("/api/admin/templates/:templateId", async (request, reply) => {
    const actor = await actorFor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" }); if (actor.platformRole !== "super_admin") return reply.code(403).send({ code: "SUPER_ADMIN_REQUIRED" });
    const template = await options.database.query.templateVersions.findFirst({ where: eq(templateVersions.id, request.params.templateId) }); if (!template) return reply.code(404).send({ code: "TEMPLATE_NOT_FOUND" });
    const usage = await usageCount(options.database, template.id); if (usage) { await options.database.update(templateVersions).set({ state: "retired", updatedAt: new Date() }).where(eq(templateVersions.id, template.id)); return { template: templateResponse({ ...template, state: "retired" }), retired: true }; }
    await options.database.delete(templateVersions).where(eq(templateVersions.id, template.id)); return reply.code(204).send();
  });
};
async function actorFor(options: Options, token: string | undefined) { return token ? getActorFromToken(options.database, token) : null; }
async function usageCount(database: AppDatabase, templateVersionId: string) { const [row] = await database.select({ count: sql<number>`count(*)` }).from(templateUsages).where(eq(templateUsages.templateVersionId, templateVersionId)); return Number(row?.count ?? 0); }
function templateResponse(template: typeof templateVersions.$inferSelect) { return { ...template, paperSize: "A5" as const, orientation: "portrait" as const }; }
