import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { requireChildAccess, requireChildEdit } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { cardPhotos, children, exportJobs, handbookCards, handbooks, mediaAssets, observationCards, templateUsages, templateVersions } from "../db/schema.js";
import { renderHandbookPdf } from "../exports/pdf.js";

type Opt = { database: AppDatabase; config: ApiConfig };
type Snapshot = { title: string; introduction: string; startedAt?: string; completedAt?: string | null; child: { name: string }; kind: "screen" | "print"; coverPhoto?: { originalPath: string; mimeType: string }; backPhoto?: { originalPath: string; mimeType: string }; templates?: { id: string; kind: string; layout: { photos?: { x: number; y: number; width: number; height: number }[]; texts?: { x: number; y: number; width: number; height: number; content: string; color: string; fontSize: number }[]; lines?: { x: number; y: number; width: number; color: string; thickness?: number }[] } }[]; cards: { observedAt: string; text: string; textBlocks?: string[]; templateId?: string | null; photos: { originalPath: string; mimeType: string }[] }[] };

export const registerExportRoutes: FastifyPluginAsync<Opt> = async (app, options) => {
  const actor = async (token?: string) => token ? getActorFromToken(options.database, token) : null;

  app.get<{ Params: { childId: string } }>("/api/children/:childId/exports", async (request, reply) => {
    const currentActor = await actor(request.cookies[options.config.sessionCookie.name]);
    if (!currentActor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildAccess(currentActor, child); } catch { return reply.code(403).send({ code: "FAMILY_ACCESS_DENIED" }); }
    return { exports: await options.database.select().from(exportJobs).where(eq(exportJobs.childId, child.id)) };
  });

  app.post<{ Params: { childId: string }; Body: { handbookId?: string; kind?: "screen" | "print" } }>("/api/children/:childId/exports", async (request, reply) => {
    const currentActor = await actor(request.cookies[options.config.sessionCookie.name]);
    if (!currentActor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try { requireChildEdit(currentActor, child); } catch { return reply.code(403).send({ code: "CHILD_EDIT_REQUIRED" }); }
    const handbook = request.body.handbookId && await options.database.query.handbooks.findFirst({ where: eq(handbooks.id, request.body.handbookId) });
    if (!handbook || handbook.childId !== child.id) return reply.code(400).send({ code: "EXPORT_PREFLIGHT_FAILED" });
    const kind = request.body.kind;
    if (kind !== "screen" && kind !== "print") return reply.code(400).send({ code: "EXPORT_KIND_INVALID" });

    const links = await options.database.select().from(handbookCards).where(eq(handbookCards.handbookId, handbook.id)).orderBy(handbookCards.position);
    const cardRows = (await Promise.all(links.map(link => options.database.query.observationCards.findFirst({ where: eq(observationCards.id, link.cardId) })))).filter((card): card is typeof observationCards.$inferSelect => Boolean(card));
    const templateIds = [handbook.coverTemplateId, handbook.backTemplateId, ...cardRows.map(card => card.templateId)].filter((id): id is string => Boolean(id));
    const templates = await Promise.all(templateIds.map(id => options.database.query.templateVersions.findFirst({ where: eq(templateVersions.id, id) })));
    const coverPhoto = handbook.coverPhotoId ? await options.database.select({ originalPath: mediaAssets.originalPath, mimeType: mediaAssets.mimeType }).from(mediaAssets).where(eq(mediaAssets.id, handbook.coverPhotoId)).then(rows => rows[0]) : undefined;
    const backPhoto = handbook.backPhotoId ? await options.database.select({ originalPath: mediaAssets.originalPath, mimeType: mediaAssets.mimeType }).from(mediaAssets).where(eq(mediaAssets.id, handbook.backPhotoId)).then(rows => rows[0]) : undefined;
    // Export is intentionally best-effort: a handbook may be empty, use a
    // low-resolution photo, or contain a retired template. The PDF renderer
    // already has safe fallbacks for each of these cases, so none should block
    // the user's request to generate a file.
    const snapshot = JSON.stringify({
      handbookId: handbook.id, title: handbook.title, introduction: handbook.introduction, startedAt: handbook.startedAt, completedAt: handbook.completedAt, child: { id: child.id, name: child.name }, kind, coverPhoto, backPhoto,
      format: { paperSize: "A5", orientation: "portrait", bleedMm: kind === "print" ? 3 : 0, cropMarks: kind === "print" },
      templates: templates.filter(Boolean).map(template => ({ id: template!.id, name: template!.name, kind: template!.kind, layout: JSON.parse(template!.layout) })),
      cards: await Promise.all(cardRows.map(async card => ({
        id: card.id, observedAt: card.observedAt, text: card.text, textBlocks: card.textBlocks ? JSON.parse(card.textBlocks) : undefined, templateId: card.templateId,
        photos: await options.database.select({ originalPath: mediaAssets.originalPath, mimeType: mediaAssets.mimeType }).from(cardPhotos).innerJoin(mediaAssets, eq(cardPhotos.mediaAssetId, mediaAssets.id)).where(eq(cardPhotos.cardId, card.id)).orderBy(cardPhotos.position),
      }))),
    });
    const job = { id: randomUUID(), childId: child.id, handbookId: handbook.id, kind, snapshot, createdAt: new Date() };
    options.database.transaction(transaction => {
      transaction.insert(exportJobs).values(job).run();
      templates.filter((template): template is NonNullable<typeof template> => Boolean(template)).forEach(template => transaction.insert(templateUsages).values({ id: randomUUID(), templateVersionId: template.id, referenceType: "export", referenceId: job.id, createdAt: job.createdAt }).run());
    });
    return reply.code(201).send({ export: job });
  });

  app.get<{ Params: { exportId: string } }>("/api/exports/:exportId/download", async (request, reply) => {
    const rendered = await renderExportPdf(options, request.cookies[options.config.sessionCookie.name], request.params.exportId);
    if ("error" in rendered) return reply.code(rendered.statusCode).send(rendered.error);
    return reply.header("content-disposition", `attachment; filename="${request.params.exportId}.pdf"`).type("application/pdf").send(rendered);
  });

  app.delete<{ Params: { exportId: string } }>("/api/exports/:exportId", async (request, reply) => {
    const currentActor = await actor(request.cookies[options.config.sessionCookie.name]);
    if (!currentActor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const job = await options.database.query.exportJobs.findFirst({ where: eq(exportJobs.id, request.params.exportId) });
    if (!job) return reply.code(404).send({ code: "EXPORT_NOT_FOUND" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, job.childId) });
    if (!child) return reply.code(404).send();
    try { requireChildEdit(currentActor, child); } catch { return reply.code(403).send({ code: "CHILD_EDIT_REQUIRED" }); }
    await options.database.delete(exportJobs).where(eq(exportJobs.id, job.id));
    return reply.code(204).send();
  });
};

type ExportPdfError = { statusCode: number; error?: { code: string } };

async function renderExportPdf(options: Opt, token: string | undefined, exportId: string): Promise<Buffer | ExportPdfError> {
  const currentActor = token ? await getActorFromToken(options.database, token) : null;
  if (!currentActor) return { statusCode: 401, error: { code: "AUTH_REQUIRED" } };
  const job = await options.database.query.exportJobs.findFirst({ where: eq(exportJobs.id, exportId) });
  if (!job) return { statusCode: 404, error: { code: "EXPORT_NOT_FOUND" } };
  const child = await options.database.query.children.findFirst({ where: eq(children.id, job.childId) });
  if (!child) return { statusCode: 404 };
  try { requireChildAccess(currentActor, child); } catch { return { statusCode: 403, error: { code: "FAMILY_ACCESS_DENIED" } }; }
  const snapshot = JSON.parse(job.snapshot) as Snapshot;
  const mediaDirectory = resolve(options.config.mediaDirectory);
  const cards = await Promise.all(snapshot.cards.map(async card => {
    const photos = await Promise.all(card.photos.map(async photo => ({ dataUrl: await photoDataUrl(mediaDirectory, photo) })));
    const template = card.templateId ? snapshot.templates?.find(item => item.id === card.templateId) : undefined;
    return { ...card, photos, layout: template?.layout };
  }));
  const coverPhoto = snapshot.coverPhoto ? { dataUrl: await photoDataUrl(mediaDirectory, snapshot.coverPhoto) } : undefined;
  const backPhoto = snapshot.backPhoto ? { dataUrl: await photoDataUrl(mediaDirectory, snapshot.backPhoto) } : undefined;
  return renderHandbookPdf({ ...snapshot, documentId: job.id, childName: snapshot.child.name, cards, coverPhoto, backPhoto });
}

async function photoDataUrl(mediaDirectory: string, photo: { originalPath: string; mimeType: string }) {
  const filePath = resolve(mediaDirectory, photo.originalPath);
  if (!filePath.startsWith(`${mediaDirectory}${sep}`)) throw new Error("MEDIA_PATH_INVALID");
  return `data:${photo.mimeType};base64,${(await readFile(filePath)).toString("base64")}`;
}
