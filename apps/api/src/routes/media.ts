import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { requireChildAccess, requireFamilyAdmin } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { auditLogs, children, mediaAssets } from "../db/schema.js";
import { storeChildImage } from "../media/storage.js";

type MediaRouteOptions = { database: AppDatabase; config: ApiConfig };

export const registerMediaRoutes: FastifyPluginAsync<MediaRouteOptions> = async (app, options) => {
  app.post<{ Params: { childId: string } }>("/api/children/:childId/media", async (request, reply) => {
    const token = request.cookies[options.config.sessionCookie.name];
    const actor = token ? await getActorFromToken(options.database, token) : null;
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try {
      requireFamilyAdmin(actor, child.familyId);
    } catch (error) {
      return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ADMIN_REQUIRED" });
    }

    const upload = await request.file();
    if (!upload) return reply.code(400).send({ code: "MEDIA_FILE_REQUIRED" });
    try {
      const stored = await storeChildImage({ mediaDirectory: options.config.mediaDirectory, mimeType: upload.mimetype, data: await upload.toBuffer() });
      options.database.transaction(transaction => {
        transaction.insert(mediaAssets).values({ ...stored, childId: child.id, createdAt: new Date() }).run();
        transaction.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "media.uploaded", targetType: "media_asset", targetId: stored.id, metadata: JSON.stringify({ mimeType: stored.mimeType, width: stored.width, height: stored.height }), createdAt: new Date() }).run();
      });
      return reply.code(201).send({ media: { id: stored.id, childId: child.id, thumbnailUrl: `/api/media/${stored.id}/thumbnail`, width: stored.width, height: stored.height } });
    } catch (error) {
      const code = error instanceof Error ? error.message : "MEDIA_UPLOAD_FAILED";
      return reply.code(code.startsWith("MEDIA_") ? 400 : 500).send({ code });
    }
  });

  app.get<{ Params: { mediaId: string } }>("/api/media/:mediaId/thumbnail", async (request, reply) => {
    const token = request.cookies[options.config.sessionCookie.name];
    const actor = token ? await getActorFromToken(options.database, token) : null;
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });

    const media = await options.database.query.mediaAssets.findFirst({ where: eq(mediaAssets.id, request.params.mediaId) });
    if (!media) return reply.code(404).send({ code: "MEDIA_NOT_FOUND" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, media.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try {
      requireChildAccess(actor, child);
    } catch (error) {
      return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ACCESS_DENIED" });
    }

    const mediaDirectory = resolve(options.config.mediaDirectory);
    const filePath = resolve(mediaDirectory, media.thumbnailPath);
    if (!filePath.startsWith(`${mediaDirectory}${sep}`)) return reply.code(404).send({ code: "MEDIA_NOT_FOUND" });
    try {
      return reply.type(media.mimeType).send(await readFile(filePath));
    } catch {
      return reply.code(404).send({ code: "MEDIA_NOT_FOUND" });
    }
  });
};
