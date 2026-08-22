import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { assertSameChildIds, requireChildAccess, requireFamilyAdmin } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { auditLogs, cardTags, children, handbookCards, handbookTags, handbooks, observationCards, tags } from "../db/schema.js";

type HandbookRouteOptions = { database: AppDatabase; config: ApiConfig };
type HandbookPayload = { title?: string; introduction?: string; startedAt?: string; completedAt?: string; tagIds?: unknown; cardIds?: unknown };

export const registerHandbookRoutes: FastifyPluginAsync<HandbookRouteOptions> = async (app, options) => {
  app.post<{ Params: { childId: string }; Body: HandbookPayload }>("/api/children/:childId/handbooks", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireFamilyAdmin(actor, child.familyId); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ADMIN_REQUIRED" }); }

    const title = request.body.title?.trim();
    const introduction = request.body.introduction?.trim();
    const startedAt = request.body.startedAt;
    const completedAt = request.body.completedAt?.trim() || null;
    if (!title || !introduction) return reply.code(400).send({ code: "HANDBOOK_DETAILS_REQUIRED" });
    if (!startedAt || !/^\d{4}-\d{2}-\d{2}$/.test(startedAt) || (completedAt && !/^\d{4}-\d{2}-\d{2}$/.test(completedAt))) return reply.code(400).send({ code: "HANDBOOK_DATE_INVALID" });
    const tagIds = stringArray(request.body.tagIds);
    const explicitCardIds = stringArray(request.body.cardIds);
    const selectedTags = tagIds.length ? await options.database.select().from(tags).where(inArray(tags.id, tagIds)) : [];
    if (selectedTags.length !== tagIds.length) return reply.code(404).send({ code: "TAG_NOT_FOUND" });
    try { assertSameChildIds(child.id, selectedTags.map(tag => tag.childId)); } catch { return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" }); }
    const tagCardRows = tagIds.length ? await options.database.select({ cardId: cardTags.cardId }).from(cardTags).where(inArray(cardTags.tagId, tagIds)) : [];
    const cardIds = [...new Set([...tagCardRows.map(row => row.cardId), ...explicitCardIds])];
    const selectedCards = cardIds.length ? await options.database.select().from(observationCards).where(inArray(observationCards.id, cardIds)) : [];
    if (selectedCards.length !== cardIds.length) return reply.code(404).send({ code: "CARD_NOT_FOUND" });
    try { assertSameChildIds(child.id, selectedCards.map(card => card.childId)); } catch { return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" }); }

    const now = new Date();
    const handbook = { id: randomUUID(), childId: child.id, title, introduction, startedAt, completedAt, visibility: "family" as const, createdAt: now, updatedAt: now };
    options.database.transaction(transaction => {
      transaction.insert(handbooks).values(handbook).run();
      if (selectedTags.length) transaction.insert(handbookTags).values(selectedTags.map(tag => ({ handbookId: handbook.id, tagId: tag.id }))).run();
      if (cardIds.length) transaction.insert(handbookCards).values(cardIds.map((cardId, position) => ({ handbookId: handbook.id, cardId, position }))).run();
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "handbook.created", targetType: "handbook", targetId: handbook.id, metadata: JSON.stringify({ tagCount: selectedTags.length, cardCount: cardIds.length }), createdAt: now }).run();
    });
    return reply.code(201).send({ handbook: handbookResponse(handbook, cardIds, tagIds) });
  });

  app.get<{ Params: { handbookId: string } }>("/api/handbooks/:handbookId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const handbook = await options.database.query.handbooks.findFirst({ where: eq(handbooks.id, request.params.handbookId) });
    if (!handbook) return reply.code(404).send({ code: "HANDBOOK_NOT_FOUND" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, handbook.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildAccess(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ACCESS_DENIED" }); }
    const cards = await options.database.select({ cardId: handbookCards.cardId }).from(handbookCards).where(eq(handbookCards.handbookId, handbook.id)).orderBy(handbookCards.position);
    const relatedTags = await options.database.select({ tagId: handbookTags.tagId }).from(handbookTags).where(eq(handbookTags.handbookId, handbook.id));
    return { handbook: handbookResponse(handbook, cards.map(card => card.cardId), relatedTags.map(tag => tag.tagId)) };
  });
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string") ? [...new Set(value)] : [];
}

function handbookResponse(handbook: typeof handbooks.$inferSelect, cardIds: string[], tagIds: string[]) {
  return { id: handbook.id, childId: handbook.childId, title: handbook.title, introduction: handbook.introduction, startedAt: handbook.startedAt, completedAt: handbook.completedAt, visibility: handbook.visibility, status: handbook.completedAt ? "completed" : "ongoing", cardIds, tagIds };
}

async function getActor(options: HandbookRouteOptions, token: string | undefined) {
  return token ? getActorFromToken(options.database, token) : null;
}
