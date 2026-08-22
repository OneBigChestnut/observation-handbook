import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { requireChildAccess } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { children, mediaAssets } from "../db/schema.js";

type MediaRouteOptions = { database: AppDatabase; config: ApiConfig };

export const registerMediaRoutes: FastifyPluginAsync<MediaRouteOptions> = async (app, options) => {
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
