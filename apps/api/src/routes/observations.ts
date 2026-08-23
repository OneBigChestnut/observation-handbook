import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { assertCardPhotoCount, assertSameChildIds, requireChildAccess, requireFamilyAdmin } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { auditLogs, cardPhotos, cardTags, children, handbookCards, mediaAssets, observationCards, tags } from "../db/schema.js";

type ObservationRouteOptions = { database: AppDatabase; config: ApiConfig };
type CardPayload = { observedAt?: string; text?: string; mediaAssetIds?: unknown; tagNames?: unknown };

export const registerObservationRoutes: FastifyPluginAsync<ObservationRouteOptions> = async (app, options) => {
  app.get<{ Params: { childId: string } }>("/api/children/:childId/tags", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildAccess(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ACCESS_DENIED" }); }
    const childTags = await options.database.select().from(tags).where(eq(tags.childId, child.id));
    const tagIds = childTags.map(tag => tag.id);
    const associations = tagIds.length ? await options.database.select({ tagId: cardTags.tagId }).from(cardTags).where(inArray(cardTags.tagId, tagIds)) : [];
    const cardCountByTag = new Map<string, number>();
    for (const association of associations) cardCountByTag.set(association.tagId, (cardCountByTag.get(association.tagId) ?? 0) + 1);
    return { tags: childTags.map(tag => ({ ...tag, cardCount: cardCountByTag.get(tag.id) ?? 0 })) };
  });

  app.post<{ Params: { childId: string }; Body: { name?: string; color?: string } }>("/api/children/:childId/tags", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireFamilyAdmin(actor, child.familyId); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ADMIN_REQUIRED" }); }
    const name = request.body.name?.trim();
    if (!name) return reply.code(400).send({ code: "TAG_NAME_REQUIRED" });
    const existing = await options.database.query.tags.findFirst({ where: tag => and(eq(tag.childId, child.id), eq(tag.name, name)) });
    if (existing) return reply.code(409).send({ code: "TAG_NAME_CONFLICT" });
    const tag = { id: randomUUID(), childId: child.id, name, color: request.body.color?.trim() || "olive", createdAt: new Date() };
    options.database.transaction(transaction => {
      transaction.insert(tags).values(tag).run();
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "tag.created", targetType: "tag", targetId: tag.id, metadata: JSON.stringify({ name: tag.name, color: tag.color }), createdAt: new Date() }).run();
    });
    return reply.code(201).send({ tag: { ...tag, cardCount: 0 } });
  });

  app.get<{ Params: { childId: string } }>("/api/children/:childId/cards", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildAccess(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ACCESS_DENIED" }); }
    const cards = await options.database.select().from(observationCards).where(and(eq(observationCards.childId, child.id), eq(observationCards.state, "active"))).orderBy(desc(observationCards.observedAt));
    return { cards: await Promise.all(cards.map(card => projectCard(options.database, card))) };
  });

  app.post<{ Params: { childId: string }; Body: CardPayload }>("/api/children/:childId/cards", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireFamilyAdmin(actor, child.familyId); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ADMIN_REQUIRED" }); }

    const observedAt = request.body.observedAt;
    const mediaAssetIds = Array.isArray(request.body.mediaAssetIds) && request.body.mediaAssetIds.every(id => typeof id === "string") ? request.body.mediaAssetIds : [];
    const tagNames = Array.isArray(request.body.tagNames) && request.body.tagNames.every(name => typeof name === "string") ? [...new Set(request.body.tagNames.map(name => name.trim()).filter(Boolean))] : [];
    if (!observedAt || !/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) return reply.code(400).send({ code: "CARD_DATE_INVALID" });
    try { assertCardPhotoCount(mediaAssetIds.length); } catch (error) { return reply.code(400).send({ code: error instanceof Error ? error.message : "CARD_PHOTO_COUNT_INVALID" }); }
    const media = await options.database.select().from(mediaAssets).where(inArray(mediaAssets.id, mediaAssetIds));
    if (media.length !== mediaAssetIds.length || media.some(item => item.childId !== child.id)) return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" });

    const existingTags = await options.database.select().from(tags).where(eq(tags.childId, child.id));
    const byName = new Map(existingTags.map(tag => [tag.name, tag]));
    const newTags = tagNames.filter(name => !byName.has(name)).map(name => ({ id: randomUUID(), childId: child.id, name, color: "olive", createdAt: new Date() }));
    const card = { id: randomUUID(), childId: child.id, observedAt, text: request.body.text?.trim() ?? "", state: "active" as const, createdAt: new Date(), updatedAt: new Date() };
    const tagRecords = [...existingTags.filter(tag => tagNames.includes(tag.name)), ...newTags];
    options.database.transaction(transaction => {
      if (newTags.length) transaction.insert(tags).values(newTags).run();
      transaction.insert(observationCards).values(card).run();
      transaction.insert(cardPhotos).values(mediaAssetIds.map((mediaAssetId, position) => ({ cardId: card.id, mediaAssetId, position }))).run();
      if (tagRecords.length) transaction.insert(cardTags).values(tagRecords.map(tag => ({ cardId: card.id, tagId: tag.id }))).run();
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "card.created", targetType: "observation_card", targetId: card.id, metadata: JSON.stringify({ photoCount: mediaAssetIds.length, tagCount: tagRecords.length }), createdAt: new Date() }).run();
    });
    return reply.code(201).send({ card: await projectCard(options.database, card) });
  });

  app.patch<{ Params: { cardId: string }; Body: CardPayload }>("/api/cards/:cardId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const card = await options.database.query.observationCards.findFirst({ where: eq(observationCards.id, request.params.cardId) });
    if (!card) return reply.code(404).send({ code: "CARD_NOT_FOUND" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, card.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireFamilyAdmin(actor, child.familyId); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ADMIN_REQUIRED" }); }
    const next = { ...card, text: request.body.text === undefined ? card.text : request.body.text.trim(), observedAt: request.body.observedAt ?? card.observedAt, updatedAt: new Date() };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next.observedAt)) return reply.code(400).send({ code: "CARD_DATE_INVALID" });
    options.database.transaction(transaction => {
      transaction.update(observationCards).set({ text: next.text, observedAt: next.observedAt, updatedAt: next.updatedAt }).where(eq(observationCards.id, card.id)).run();
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "card.updated", targetType: "observation_card", targetId: card.id, metadata: JSON.stringify({ observedAt: next.observedAt }), createdAt: next.updatedAt }).run();
    });
    return { card: await projectCard(options.database, next) };
  });

  app.delete<{ Params: { cardId: string } }>("/api/cards/:cardId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const card = await options.database.query.observationCards.findFirst({ where: eq(observationCards.id, request.params.cardId) });
    if (!card) return reply.code(404).send({ code: "CARD_NOT_FOUND" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, card.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireFamilyAdmin(actor, child.familyId); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ADMIN_REQUIRED" }); }
    const references = await options.database.select({ handbookId: handbookCards.handbookId }).from(handbookCards).where(eq(handbookCards.cardId, card.id));
    if (references.length) return reply.code(409).send({ code: "CARD_REFERENCED", affectedHandbookIds: references.map(item => item.handbookId) });
    const now = new Date();
    options.database.transaction(transaction => { transaction.update(observationCards).set({ state: "archived", updatedAt: now }).where(eq(observationCards.id, card.id)).run(); transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "card.archived", targetType: "observation_card", targetId: card.id, metadata: "{}", createdAt: now }).run(); });
    return reply.code(204).send();
  });
};

async function getActor(options: ObservationRouteOptions, token: string | undefined) {
  return token ? getActorFromToken(options.database, token) : null;
}

async function projectCard(database: AppDatabase, card: typeof observationCards.$inferSelect) {
  const photos = await database.select({ id: mediaAssets.id, thumbnailUrl: mediaAssets.id }).from(cardPhotos).innerJoin(mediaAssets, eq(cardPhotos.mediaAssetId, mediaAssets.id)).where(eq(cardPhotos.cardId, card.id)).orderBy(cardPhotos.position);
  const cardTagRows = await database.select({ id: tags.id, name: tags.name, color: tags.color }).from(cardTags).innerJoin(tags, eq(cardTags.tagId, tags.id)).where(eq(cardTags.cardId, card.id));
  return { id: card.id, childId: card.childId, observedAt: card.observedAt, text: card.text, photos: photos.map(photo => ({ id: photo.id, thumbnailUrl: `/api/media/${photo.thumbnailUrl}/thumbnail` })), tags: cardTagRows };
}
