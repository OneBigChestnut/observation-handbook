import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { assertCardPhotoCount, assertSameChildIds, requireChildAccess, requireChildEdit } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { auditLogs, cardPhotos, cardTags, children, handbookCards, handbooks, mediaAssets, observationCards, observationProjects, tags, templateUsages, templateVersions } from "../db/schema.js";

type ObservationRouteOptions = { database: AppDatabase; config: ApiConfig };
type CardPayload = { observedAt?: string; text?: string; textBlocks?: unknown; mediaAssetIds?: unknown; tagIds?: unknown; tagNames?: unknown; handbookIds?: unknown; templateId?: string; projectId?: string; observationPart?: string; season?: string; stage?: string; changeNote?: string; evidence?: string; hypothesis?: string };

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
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }
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

  app.patch<{ Params: { childId: string; tagId: string }; Body: { name?: string; color?: string } }>("/api/children/:childId/tags/:tagId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }
    const tag = await options.database.query.tags.findFirst({ where: eq(tags.id, request.params.tagId) });
    if (!tag || tag.childId !== child.id) return reply.code(404).send({ code: "TAG_NOT_FOUND" });
    const name = request.body.name === undefined ? tag.name : request.body.name.trim();
    const color = request.body.color === undefined ? tag.color : request.body.color.trim();
    if (!name) return reply.code(400).send({ code: "TAG_NAME_REQUIRED" });
    if (!color) return reply.code(400).send({ code: "TAG_COLOR_REQUIRED" });
    const sameName = await options.database.select().from(tags).where(and(eq(tags.childId, child.id), eq(tags.name, name)));
    if (sameName.some(item => item.id !== tag.id)) return reply.code(409).send({ code: "TAG_NAME_CONFLICT" });
    const updatedAt = new Date();
    options.database.transaction(transaction => {
      transaction.update(tags).set({ name, color }).where(eq(tags.id, tag.id)).run();
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "tag.updated", targetType: "tag", targetId: tag.id, metadata: JSON.stringify({ name, color }), createdAt: updatedAt }).run();
    });
    const associations = await options.database.select({ tagId: cardTags.tagId }).from(cardTags).where(eq(cardTags.tagId, tag.id));
    return { tag: { ...tag, name, color, cardCount: associations.length } };
  });

  app.delete<{ Params: { childId: string; tagId: string } }>("/api/children/:childId/tags/:tagId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }
    const tag = await options.database.query.tags.findFirst({ where: eq(tags.id, request.params.tagId) });
    if (!tag || tag.childId !== child.id) return reply.code(404).send({ code: "TAG_NOT_FOUND" });
    const associations = await options.database.select({ cardId: cardTags.cardId }).from(cardTags).where(eq(cardTags.tagId, tag.id));
    if (associations.length) return reply.code(409).send({ code: "TAG_IN_USE" });
    const deletedAt = new Date();
    options.database.transaction(transaction => {
      transaction.delete(tags).where(eq(tags.id, tag.id)).run();
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "tag.deleted", targetType: "tag", targetId: tag.id, metadata: JSON.stringify({ name: tag.name }), createdAt: deletedAt }).run();
    });
    return reply.code(204).send();
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
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }

    const observedAt = request.body.observedAt;
    const projectId = request.body.projectId?.trim();
    const project = projectId && await options.database.query.observationProjects.findFirst({ where: eq(observationProjects.id, projectId) });
    if (projectId && (!project || project.childId !== child.id)) return reply.code(400).send({ code: "PROJECT_SELECTION_INVALID" });
    const mediaAssetIds = Array.isArray(request.body.mediaAssetIds) && request.body.mediaAssetIds.every(id => typeof id === "string") ? request.body.mediaAssetIds : [];
    const tagIds = Array.isArray(request.body.tagIds) && request.body.tagIds.every(id => typeof id === "string") ? [...new Set(request.body.tagIds)] : [];
    const tagNames = Array.isArray(request.body.tagNames) && request.body.tagNames.every(name => typeof name === "string") ? [...new Set(request.body.tagNames.map(name => name.trim()).filter(Boolean))] : [];
    const handbookIds = Array.isArray(request.body.handbookIds) && request.body.handbookIds.every(id => typeof id === "string") ? [...new Set(request.body.handbookIds)] : [];
    if (!observedAt || !/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) return reply.code(400).send({ code: "CARD_DATE_INVALID" });
    try { assertCardPhotoCount(mediaAssetIds.length); } catch (error) { return reply.code(400).send({ code: error instanceof Error ? error.message : "CARD_PHOTO_COUNT_INVALID" }); }
    const media = await options.database.select().from(mediaAssets).where(inArray(mediaAssets.id, mediaAssetIds));
    if (media.length !== mediaAssetIds.length || media.some(item => item.childId !== child.id)) return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" });
    const templateId = request.body.templateId?.trim() || null;
    if (templateId) {
      const template = await options.database.query.templateVersions.findFirst({ where: eq(templateVersions.id, templateId) });
      if (!template || template.state !== "published" || template.kind !== `card_${mediaAssetIds.length}`) return reply.code(400).send({ code: "TEMPLATE_SELECTION_INVALID" });
    }
    const selectedHandbooks = handbookIds.length ? await options.database.select().from(handbooks).where(inArray(handbooks.id, handbookIds)) : [];
    if (selectedHandbooks.length !== handbookIds.length || selectedHandbooks.some(handbook => handbook.childId !== child.id)) return reply.code(400).send({ code: "HANDBOOK_SELECTION_INVALID" });
    const handbookPositionById = new Map<string, number>();
    if (handbookIds.length) {
      const currentRows = await options.database.select({ handbookId: handbookCards.handbookId, position: handbookCards.position }).from(handbookCards).where(inArray(handbookCards.handbookId, handbookIds));
      for (const handbookId of handbookIds) {
        const positions = currentRows.filter(row => row.handbookId === handbookId).map(row => row.position);
        handbookPositionById.set(handbookId, positions.length ? Math.max(...positions) + 1 : 0);
      }
    }

    if (tagIds.length && tagNames.length) return reply.code(400).send({ code: "TAG_SELECTION_INVALID" });
    const existingTags = await options.database.select().from(tags).where(eq(tags.childId, child.id));
    const selectedTags = tagIds.length ? existingTags.filter(tag => tagIds.includes(tag.id)) : existingTags.filter(tag => tagNames.includes(tag.name));
    const requestedTagCount = tagIds.length || tagNames.length;
    if (requestedTagCount && selectedTags.length !== requestedTagCount) return reply.code(400).send({ code: "TAG_SELECTION_INVALID" });
    const textBlocks = Array.isArray(request.body.textBlocks) && request.body.textBlocks.every(value => typeof value === "string") ? request.body.textBlocks.slice(0, 8).map(value => value.trim()) : null;
    const card = { id: randomUUID(), childId: child.id, projectId: projectId || null, observationPart: request.body.observationPart?.trim() || null, season: request.body.season?.trim() || null, stage: request.body.stage?.trim() || null, changeNote: request.body.changeNote?.trim() || null, evidence: request.body.evidence?.trim() || null, hypothesis: request.body.hypothesis?.trim() || null, observedAt, text: request.body.text?.trim() ?? "", textBlocks: textBlocks ? JSON.stringify(textBlocks) : null, state: "active" as const, templateId, createdAt: new Date(), updatedAt: new Date() };
    options.database.transaction(transaction => {
      transaction.insert(observationCards).values(card).run();
      if (templateId) transaction.insert(templateUsages).values({ id: randomUUID(), templateVersionId: templateId, referenceType: "observation_card", referenceId: card.id, createdAt: card.createdAt }).run();
      transaction.insert(cardPhotos).values(mediaAssetIds.map((mediaAssetId, position) => ({ cardId: card.id, mediaAssetId, position }))).run();
      if (selectedTags.length) transaction.insert(cardTags).values(selectedTags.map(tag => ({ cardId: card.id, tagId: tag.id }))).run();
      if (selectedHandbooks.length) transaction.insert(handbookCards).values(selectedHandbooks.map(handbook => ({ handbookId: handbook.id, cardId: card.id, position: handbookPositionById.get(handbook.id) ?? 0 }))).run();
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "card.created", targetType: "observation_card", targetId: card.id, metadata: JSON.stringify({ photoCount: mediaAssetIds.length, tagCount: selectedTags.length }), createdAt: new Date() }).run();
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
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }
    const textBlocks = Array.isArray(request.body.textBlocks) && request.body.textBlocks.every(value => typeof value === "string") ? request.body.textBlocks.slice(0, 8).map(value => value.trim()) : undefined;
    const hasTemplateId = request.body.templateId !== undefined;
    const requestedTemplateId = typeof request.body.templateId === "string" ? request.body.templateId.trim() : "";
    const next = { ...card, text: request.body.text === undefined ? card.text : request.body.text.trim(), textBlocks: textBlocks === undefined ? card.textBlocks : JSON.stringify(textBlocks), observedAt: request.body.observedAt ?? card.observedAt, templateId: hasTemplateId ? (requestedTemplateId || null) : card.templateId, updatedAt: new Date() };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next.observedAt)) return reply.code(400).send({ code: "CARD_DATE_INVALID" });
    const hasTagIds = Array.isArray(request.body.tagIds) && request.body.tagIds.every(id => typeof id === "string");
    const tagIds = hasTagIds ? [...new Set(request.body.tagIds as string[])] : [];
    const hasTagNames = Array.isArray(request.body.tagNames) && request.body.tagNames.every(name => typeof name === "string");
    const tagNames = hasTagNames ? [...new Set((request.body.tagNames as string[]).map(name => name.trim()).filter(Boolean))] : [];
    if (hasTagIds && hasTagNames) return reply.code(400).send({ code: "TAG_SELECTION_INVALID" });
    const hasHandbooks = Array.isArray(request.body.handbookIds) && request.body.handbookIds.every(id => typeof id === "string");
    const handbookIds = hasHandbooks ? [...new Set(request.body.handbookIds as string[])] : [];
    const selectedHandbooks = handbookIds.length ? await options.database.select().from(handbooks).where(inArray(handbooks.id, handbookIds)) : [];
    if (hasHandbooks && (selectedHandbooks.length !== handbookIds.length || selectedHandbooks.some(handbook => handbook.childId !== child.id))) return reply.code(400).send({ code: "HANDBOOK_SELECTION_INVALID" });
    const handbookPositionById = new Map<string, number>();
    if (hasHandbooks && handbookIds.length) {
      const handbookRows = await options.database.select({ handbookId: handbookCards.handbookId, cardId: handbookCards.cardId, position: handbookCards.position }).from(handbookCards).where(inArray(handbookCards.handbookId, handbookIds));
      for (const handbookId of handbookIds) {
        const currentPosition = handbookRows.find(row => row.handbookId === handbookId && row.cardId === card.id)?.position;
        const occupiedPositions = handbookRows.filter(row => row.handbookId === handbookId && row.cardId !== card.id).map(row => row.position);
        handbookPositionById.set(handbookId, currentPosition ?? (occupiedPositions.length ? Math.max(...occupiedPositions) + 1 : 0));
      }
    }
    const existingTags = await options.database.select().from(tags).where(eq(tags.childId, child.id));
    const selectedTags = hasTagIds ? existingTags.filter(tag => tagIds.includes(tag.id)) : existingTags.filter(tag => tagNames.includes(tag.name));
    const requestedTagCount = hasTagIds ? tagIds.length : tagNames.length;
    if ((hasTagIds || hasTagNames) && selectedTags.length !== requestedTagCount) return reply.code(400).send({ code: "TAG_SELECTION_INVALID" });
    const hasMedia = Array.isArray(request.body.mediaAssetIds) && request.body.mediaAssetIds.every(id => typeof id === "string");
    const mediaAssetIds = hasMedia ? [...new Set(request.body.mediaAssetIds as string[])] : [];
    if (hasMedia) {
      try { assertCardPhotoCount(mediaAssetIds.length); } catch (error) { return reply.code(400).send({ code: error instanceof Error ? error.message : "CARD_PHOTO_COUNT_INVALID" }); }
      const media = await options.database.select().from(mediaAssets).where(inArray(mediaAssets.id, mediaAssetIds));
      if (media.length !== mediaAssetIds.length || media.some(item => item.childId !== child.id)) return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" });
    }
    if (hasTemplateId && requestedTemplateId) {
      const template = await options.database.query.templateVersions.findFirst({ where: eq(templateVersions.id, requestedTemplateId) });
      const photoCount = hasMedia ? mediaAssetIds.length : (await options.database.select({ id: cardPhotos.mediaAssetId }).from(cardPhotos).where(eq(cardPhotos.cardId, card.id))).length;
      if (!template || template.state !== "published" || template.kind !== `card_${photoCount}`) return reply.code(400).send({ code: "TEMPLATE_SELECTION_INVALID" });
    }
    options.database.transaction(transaction => {
      transaction.update(observationCards).set({ text: next.text, textBlocks: next.textBlocks, observedAt: next.observedAt, templateId: next.templateId, updatedAt: next.updatedAt }).where(eq(observationCards.id, card.id)).run();
      if (hasTemplateId) { transaction.delete(templateUsages).where(and(eq(templateUsages.referenceType, "observation_card"), eq(templateUsages.referenceId, card.id))).run(); if (next.templateId) transaction.insert(templateUsages).values({ id: randomUUID(), templateVersionId: next.templateId, referenceType: "observation_card", referenceId: card.id, createdAt: next.updatedAt }).run(); }
      if (hasTagIds || hasTagNames) { transaction.delete(cardTags).where(eq(cardTags.cardId, card.id)).run(); if (selectedTags.length) transaction.insert(cardTags).values(selectedTags.map(tag => ({ cardId: card.id, tagId: tag.id }))).run(); }
      if (hasHandbooks) { transaction.delete(handbookCards).where(eq(handbookCards.cardId, card.id)).run(); if (selectedHandbooks.length) transaction.insert(handbookCards).values(selectedHandbooks.map(handbook => ({ handbookId: handbook.id, cardId: card.id, position: handbookPositionById.get(handbook.id) ?? 0 }))).run(); }
      if (hasMedia) { transaction.delete(cardPhotos).where(eq(cardPhotos.cardId, card.id)).run(); transaction.insert(cardPhotos).values(mediaAssetIds.map((mediaAssetId, position) => ({ cardId: card.id, mediaAssetId, position }))).run(); }
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
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }
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
  const template = card.templateId ? await database.query.templateVersions.findFirst({ where: eq(templateVersions.id, card.templateId) }) : undefined;
  const handbookRows = await database.select({ id: handbooks.id, title: handbooks.title }).from(handbookCards).innerJoin(handbooks, eq(handbookCards.handbookId, handbooks.id)).where(eq(handbookCards.cardId, card.id));
  return { id: card.id, childId: card.childId, observedAt: card.observedAt, createdAt: card.createdAt.toISOString(), text: card.text, textBlocks: card.textBlocks ? JSON.parse(card.textBlocks) : undefined, templateId: card.templateId, templateKind: template?.kind ?? null, templateLayout: template ? JSON.parse(template.layout) : null, photos: photos.map(photo => ({ id: photo.id, thumbnailUrl: `/api/media/${photo.thumbnailUrl}/thumbnail` })), tags: cardTagRows, handbooks: handbookRows };
}
