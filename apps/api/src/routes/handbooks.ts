import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { assertSameChildIds, requireChildAccess, requireChildEdit } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { auditLogs, cardTags, children, handbookCards, handbookPublications, handbookTags, handbooks, mediaAssets, observationCards, tags, templateUsages, templateVersions } from "../db/schema.js";

type HandbookRouteOptions = { database: AppDatabase; config: ApiConfig };
type HandbookPayload = { title?: string; introduction?: string; startedAt?: string; completedAt?: string | null; tagIds?: unknown; cardIds?: unknown; coverTemplateId?: string; backTemplateId?: string; coverPhotoId?: string | null; backPhotoId?: string | null };

export const registerHandbookRoutes: FastifyPluginAsync<HandbookRouteOptions> = async (app, options) => {
  app.get<{ Params: { childId: string } }>("/api/children/:childId/handbooks", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildAccess(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ACCESS_DENIED" }); }
    const childHandbooks = await options.database.select().from(handbooks).where(eq(handbooks.childId, child.id));
    const summaries = await Promise.all(childHandbooks.map(async handbook => {
      const cards = await options.database.select({ cardId: handbookCards.cardId }).from(handbookCards).where(eq(handbookCards.handbookId, handbook.id)).orderBy(asc(handbookCards.position));
      const relatedTags = await options.database.select({ tagId: handbookTags.tagId }).from(handbookTags).where(eq(handbookTags.handbookId, handbook.id));
      const publication = await options.database.query.handbookPublications.findFirst({ where: and(eq(handbookPublications.handbookId, handbook.id), eq(handbookPublications.state, "published")), orderBy: desc(handbookPublications.publishedAt) });
      return { ...handbookResponse(handbook, cards.map(card => card.cardId), relatedTags.map(tag => tag.tagId)), cardCount: cards.length, tagCount: relatedTags.length, publication: publication ? { id: publication.id, publishedAt: publication.publishedAt } : null };
    }));
    return { handbooks: summaries };
  });

  app.post<{ Params: { childId: string }; Body: HandbookPayload }>("/api/children/:childId/handbooks", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }

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
    const cardIds = [...new Set([...tagCardRows.map(row => row.cardId), ...explicitCardIds])].sort((left, right) => left.localeCompare(right));
    const selectedCards = cardIds.length ? await options.database.select().from(observationCards).where(inArray(observationCards.id, cardIds)) : [];
    if (selectedCards.length !== cardIds.length) return reply.code(404).send({ code: "CARD_NOT_FOUND" });
    try { assertSameChildIds(child.id, selectedCards.map(card => card.childId)); } catch { return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" }); }

    const coverTemplateId = request.body.coverTemplateId?.trim() || null;
    const backTemplateId = request.body.backTemplateId?.trim() || null;
    if (!await isPublishedTemplate(options.database, coverTemplateId, "cover") || !await isPublishedTemplate(options.database, backTemplateId, "back")) return reply.code(400).send({ code: "TEMPLATE_SELECTION_INVALID" });

    const now = new Date();
    const coverPhotoId = request.body.coverPhotoId?.trim() || null;
    const backPhotoId = request.body.backPhotoId?.trim() || null;
    const selectedPhotoIds = [coverPhotoId, backPhotoId].filter((id): id is string => Boolean(id));
    if (selectedPhotoIds.length) {
      const selectedPhotos = await options.database.select().from(mediaAssets).where(inArray(mediaAssets.id, selectedPhotoIds));
      if (selectedPhotos.length !== selectedPhotoIds.length) return reply.code(404).send({ code: "PHOTO_NOT_FOUND" });
      try { assertSameChildIds(child.id, selectedPhotos.map(photo => photo.childId)); } catch { return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" }); }
    }
    const handbook = { id: randomUUID(), childId: child.id, title, introduction, startedAt, completedAt, visibility: "family" as const, coverTemplateId, backTemplateId, coverPhotoId, backPhotoId, createdAt: now, updatedAt: now };
    options.database.transaction(transaction => {
      transaction.insert(handbooks).values(handbook).run();
      if (coverTemplateId) transaction.insert(templateUsages).values({ id: randomUUID(), templateVersionId: coverTemplateId, referenceType: "handbook_cover", referenceId: handbook.id, createdAt: now }).run();
      if (backTemplateId) transaction.insert(templateUsages).values({ id: randomUUID(), templateVersionId: backTemplateId, referenceType: "handbook_back", referenceId: handbook.id, createdAt: now }).run();
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

  app.patch<{ Params: { handbookId: string }; Body: HandbookPayload }>("/api/handbooks/:handbookId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const handbook = await options.database.query.handbooks.findFirst({ where: eq(handbooks.id, request.params.handbookId) });
    if (!handbook) return reply.code(404).send({ code: "HANDBOOK_NOT_FOUND" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, handbook.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildEdit(actor, child); } catch (error) { return reply.code(403).send({ code: error instanceof Error ? error.message : "CHILD_EDIT_REQUIRED" }); }

    const currentCards = await options.database.select({ cardId: handbookCards.cardId }).from(handbookCards).where(eq(handbookCards.handbookId, handbook.id)).orderBy(handbookCards.position);
    const currentTags = await options.database.select({ tagId: handbookTags.tagId }).from(handbookTags).where(eq(handbookTags.handbookId, handbook.id));
    const replacesCards = Array.isArray(request.body.cardIds);
    const replacesTags = Array.isArray(request.body.tagIds);
    const cardIds = replacesCards ? stringArray(request.body.cardIds) : currentCards.map(card => card.cardId);
    const tagIds = replacesTags ? stringArray(request.body.tagIds) : currentTags.map(tag => tag.tagId);
    const selectedCards = cardIds.length ? await options.database.select().from(observationCards).where(inArray(observationCards.id, cardIds)) : [];
    const selectedTags = tagIds.length ? await options.database.select().from(tags).where(inArray(tags.id, tagIds)) : [];
    if (selectedCards.length !== cardIds.length) return reply.code(404).send({ code: "CARD_NOT_FOUND" });
    if (selectedTags.length !== tagIds.length) return reply.code(404).send({ code: "TAG_NOT_FOUND" });
    try { assertSameChildIds(child.id, [...selectedCards.map(card => card.childId), ...selectedTags.map(tag => tag.childId)]); } catch { return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" }); }
    const completedAt = request.body.completedAt === undefined ? handbook.completedAt : request.body.completedAt?.trim() || null;
    if (completedAt && !/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) return reply.code(400).send({ code: "HANDBOOK_DATE_INVALID" });
    const next = { ...handbook, title: request.body.title?.trim() || handbook.title, introduction: request.body.introduction?.trim() || handbook.introduction, startedAt: request.body.startedAt?.trim() || handbook.startedAt, completedAt, coverPhotoId: request.body.coverPhotoId === undefined ? handbook.coverPhotoId : request.body.coverPhotoId?.trim() || null, backPhotoId: request.body.backPhotoId === undefined ? handbook.backPhotoId : request.body.backPhotoId?.trim() || null, updatedAt: new Date() };
    const selectedPhotoIds = [next.coverPhotoId, next.backPhotoId].filter((id): id is string => Boolean(id));
    if (selectedPhotoIds.length) {
      const selectedPhotos = await options.database.select().from(mediaAssets).where(inArray(mediaAssets.id, selectedPhotoIds));
      if (selectedPhotos.length !== selectedPhotoIds.length) return reply.code(404).send({ code: "PHOTO_NOT_FOUND" });
      try { assertSameChildIds(child.id, selectedPhotos.map(photo => photo.childId)); } catch { return reply.code(403).send({ code: "CHILD_SCOPE_VIOLATION" }); }
    }
    options.database.transaction(transaction => {
      transaction.update(handbooks).set({ title: next.title, introduction: next.introduction, startedAt: next.startedAt, completedAt: next.completedAt, coverPhotoId: next.coverPhotoId, backPhotoId: next.backPhotoId, updatedAt: next.updatedAt }).where(eq(handbooks.id, handbook.id)).run();
      if (replacesCards) { transaction.delete(handbookCards).where(eq(handbookCards.handbookId, handbook.id)).run(); if (cardIds.length) transaction.insert(handbookCards).values(cardIds.map((cardId, position) => ({ handbookId: handbook.id, cardId, position }))).run(); }
      if (replacesTags) { transaction.delete(handbookTags).where(eq(handbookTags.handbookId, handbook.id)).run(); if (tagIds.length) transaction.insert(handbookTags).values(tagIds.map(tagId => ({ handbookId: handbook.id, tagId }))).run(); }
      transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "handbook.updated", targetType: "handbook", targetId: handbook.id, metadata: JSON.stringify({ replacesCards, replacesTags, completedAt: next.completedAt }), createdAt: next.updatedAt }).run();
    });
    return { handbook: handbookResponse(next, cardIds, tagIds) };
  });
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string") ? [...new Set(value)] : [];
}

function handbookResponse(handbook: typeof handbooks.$inferSelect, cardIds: string[], tagIds: string[]) {
  return { id: handbook.id, childId: handbook.childId, title: handbook.title, introduction: handbook.introduction, startedAt: handbook.startedAt, completedAt: handbook.completedAt, visibility: handbook.visibility, coverTemplateId: handbook.coverTemplateId, backTemplateId: handbook.backTemplateId, coverPhotoId: handbook.coverPhotoId, backPhotoId: handbook.backPhotoId, status: handbook.completedAt ? "completed" : "ongoing", cardIds, tagIds };
}

async function isPublishedTemplate(database: AppDatabase, id: string | null, kind: "cover" | "back") {
  if (!id) return true;
  const template = await database.query.templateVersions.findFirst({ where: eq(templateVersions.id, id) });
  return template?.state === "published" && template.kind === kind;
}

async function getActor(options: HandbookRouteOptions, token: string | undefined) {
  return token ? getActorFromToken(options.database, token) : null;
}
