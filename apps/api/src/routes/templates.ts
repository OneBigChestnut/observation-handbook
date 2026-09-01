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
type Color = "#1c5040" | "#57806a" | "#987a44" | "#a46152" | "#254c3c";
type Box = { id: string; x: number; y: number; width: number; height: number; imageUrl?: string };
type Layout = { preset: "standard" | "natural"; safeMarginMm: 8 | 10 | 12; textAlign: "left" | "center"; photos?: Box[]; texts?: (Box & { content: string; color: Color; fontSize: number })[]; lines?: { id: string; x: number; y: number; width: number; color: Color; thickness?: number }[] };
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
  app.post<{ Body: { name?: string; kind?: string; state?: string; layout?: Layout } }>("/api/admin/templates", async (request, reply) => {
    const actor = await actorFor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (actor.platformRole !== "super_admin") return reply.code(403).send({ code: "SUPER_ADMIN_REQUIRED" });
    const name = request.body.name?.trim(); const kind = request.body.kind as Kind; const state = (request.body.state ?? "draft") as State;
    if (!name || !kinds.includes(kind) || !states.includes(state)) return reply.code(400).send({ code: "TEMPLATE_DETAILS_INVALID" });
    const layout = validLayout(request.body.layout) ?? { preset: "standard", safeMarginMm: 10, textAlign: "left" } as Layout;
    if (request.body.layout && !validLayout(request.body.layout)) return reply.code(400).send({ code: "TEMPLATE_LAYOUT_INVALID" });
    const now = new Date(); const template = { id: randomUUID(), name, kind, state, paperSize: "A5" as const, orientation: "portrait" as const, layout: JSON.stringify(layout), createdAt: now, updatedAt: now };
    await options.database.insert(templateVersions).values(template);
    await options.database.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: null, action: "template.created", targetType: "template", targetId: template.id, metadata: "{}", createdAt: now });
    return reply.code(201).send({ template: templateResponse(template) });
  });
  app.patch<{ Params: { templateId: string }; Body: { name?: string; state?: string; layout?: Layout } }>("/api/admin/templates/:templateId", async (request, reply) => {
    const actor = await actorFor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" }); if (actor.platformRole !== "super_admin") return reply.code(403).send({ code: "SUPER_ADMIN_REQUIRED" });
    const template = await options.database.query.templateVersions.findFirst({ where: eq(templateVersions.id, request.params.templateId) }); if (!template) return reply.code(404).send({ code: "TEMPLATE_NOT_FOUND" });
    const usage = await usageCount(options.database, template.id); if (usage) return reply.code(409).send({ code: "TEMPLATE_IMMUTABLE", usageCount: usage });
    const state = request.body.state as State | undefined; if (state && !states.includes(state)) return reply.code(400).send({ code: "TEMPLATE_STATE_INVALID" });
    const layout = request.body.layout === undefined ? JSON.parse(template.layout) as Layout : validLayout(request.body.layout);
    if (!layout) return reply.code(400).send({ code: "TEMPLATE_LAYOUT_INVALID" });
    const next = { ...template, name: request.body.name?.trim() || template.name, state: state ?? template.state, layout: JSON.stringify(layout), updatedAt: new Date() };
    await options.database.update(templateVersions).set({ name: next.name, state: next.state, layout: next.layout, updatedAt: next.updatedAt }).where(eq(templateVersions.id, template.id));
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
function templateResponse(template: typeof templateVersions.$inferSelect) {
  const layout = JSON.parse(template.layout) as { preset: string; safeMarginMm: number; textAlign: "left" | "center" };
  return { ...template, layout, paperSize: "A5" as const, orientation: "portrait" as const };
}
function validLayout(layout: unknown): Layout | null {
  if (!layout || typeof layout !== "object") return null;
  const value = layout as Partial<Layout>;
  if (!((value.preset === "standard" || value.preset === "natural") && (value.safeMarginMm === 8 || value.safeMarginMm === 10 || value.safeMarginMm === 12) && (value.textAlign === "left" || value.textAlign === "center"))) return null;
  const validBox = (box: unknown): box is Box => Boolean(box && typeof box === "object" && typeof (box as Box).id === "string" && ((box as Box).imageUrl === undefined || typeof (box as Box).imageUrl === "string") && ["x", "y", "width", "height"].every(key => typeof (box as Record<string, unknown>)[key] === "number" && Number((box as Record<string, number>)[key]) >= 0 && Number((box as Record<string, number>)[key]) <= 100));
  const colors: Color[] = ["#1c5040", "#57806a", "#987a44", "#a46152", "#254c3c"];
  if (value.photos && (!Array.isArray(value.photos) || !value.photos.every(validBox))) return null;
  if (value.texts && (!Array.isArray(value.texts) || !value.texts.every(text => validBox(text) && typeof text.content === "string" && typeof text.fontSize === "number" && colors.includes(text.color)))) return null;
  if (value.lines && (!Array.isArray(value.lines) || !value.lines.every(line => typeof line?.id === "string" && typeof line.x === "number" && typeof line.y === "number" && typeof line.width === "number" && (line.thickness === undefined || [1, 2, 3].includes(line.thickness)) && [line.x, line.y, line.width].every(number => number >= 0 && number <= 100) && colors.includes(line.color)))) return null;
  return value as Layout;
}
