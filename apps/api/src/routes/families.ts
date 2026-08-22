import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { requireFamilyAdmin, requireFamilyRead } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { auditLogs, children, families, familyMemberships } from "../db/schema.js";

type FamilyRouteOptions = { database: AppDatabase; config: ApiConfig };

export const registerFamilyRoutes: FastifyPluginAsync<FamilyRouteOptions> = async (app, options) => {
  app.get("/api/families/current", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });

    const memberships = await options.database.select({ id: families.id, name: families.name, role: familyMemberships.role })
      .from(familyMemberships)
      .innerJoin(families, eq(families.id, familyMemberships.familyId))
      .where(eq(familyMemberships.accountId, actor.accountId));
    const result = await Promise.all(memberships.map(async membership => ({
      ...membership,
      children: await options.database.select({ id: children.id, name: children.name }).from(children).where(eq(children.familyId, membership.id)),
    })));
    return { families: result };
  });

  app.post<{ Params: { familyId: string }; Body: { name?: string } }>("/api/families/:familyId/children", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    try {
      requireFamilyRead(actor, request.params.familyId);
      requireFamilyAdmin(actor, request.params.familyId);
    } catch (error) {
      const code = error instanceof Error ? error.message : "FAMILY_ACCESS_DENIED";
      return reply.code(403).send({ code });
    }

    const name = request.body.name?.trim();
    if (!name) return reply.code(400).send({ code: "CHILD_NAME_REQUIRED" });
    const child = { id: randomUUID(), familyId: request.params.familyId, name, createdAt: new Date() };
    await options.database.insert(children).values(child);
    await options.database.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: child.familyId, action: "child.created", targetType: "child", targetId: child.id, metadata: JSON.stringify({ name: child.name }), createdAt: new Date() });
    return reply.code(201).send({ child: { id: child.id, name: child.name } });
  });
};

async function getActor(options: FamilyRouteOptions, token: string | undefined) {
  return token ? getActorFromToken(options.database, token) : null;
}
