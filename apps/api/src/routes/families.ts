import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { and, eq } from "drizzle-orm";
import { requireChildAccess, requireFamilyAdmin, requireFamilyRead } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { accounts, auditLogs, children, families, familyMemberships } from "../db/schema.js";

type FamilyRouteOptions = { database: AppDatabase; config: ApiConfig };

export const registerFamilyRoutes: FastifyPluginAsync<FamilyRouteOptions> = async (app, options) => {
  app.get<{ Params: { childId: string } }>("/api/children/:childId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await options.database.query.children.findFirst({ where: eq(children.id, request.params.childId) });
    if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" });
    try {
      requireChildAccess(actor, child);
    } catch (error) {
      return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ACCESS_DENIED" });
    }
    return { child: { id: child.id, name: child.name, familyId: child.familyId } };
  });

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

  app.post<{ Params: { familyId: string }; Body: { accountId?: string } }>("/api/families/:familyId/members", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]);
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    try {
      requireFamilyAdmin(actor, request.params.familyId);
    } catch (error) {
      return reply.code(403).send({ code: error instanceof Error ? error.message : "FAMILY_ADMIN_REQUIRED" });
    }
    const accountId = request.body.accountId;
    if (!accountId) return reply.code(400).send({ code: "ACCOUNT_ID_REQUIRED" });
    const account = await options.database.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
    if (!account) return reply.code(404).send({ code: "ACCOUNT_NOT_FOUND" });

    await options.database.insert(familyMemberships).values({ accountId, familyId: request.params.familyId, role: "reader" }).onConflictDoNothing();
    await options.database.insert(auditLogs).values({ id: randomUUID(), actorId: actor.accountId, familyId: request.params.familyId, action: "family_member.added", targetType: "family_membership", targetId: accountId, metadata: JSON.stringify({ role: "reader" }), createdAt: new Date() });
    return reply.code(201).send({ member: { accountId, role: "reader" } });
  });
  app.delete<{ Params: { familyId: string; accountId: string } }>("/api/families/:familyId/members/:accountId", async (request, reply) => {
    const actor = await getActor(options, request.cookies[options.config.sessionCookie.name]); if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    try { requireFamilyAdmin(actor, request.params.familyId); } catch { return reply.code(403).send({ code: "FAMILY_ADMIN_REQUIRED" }); }
    const member = await options.database.query.familyMemberships.findFirst({ where: and(eq(familyMemberships.familyId, request.params.familyId), eq(familyMemberships.accountId, request.params.accountId)) });
    if (!member) return reply.code(404).send({ code: "MEMBER_NOT_FOUND" }); if (member.role === "admin") return reply.code(409).send({ code: "SOLE_ADMIN_CANNOT_REMOVE" });
    await options.database.delete(familyMemberships).where(and(eq(familyMemberships.familyId, request.params.familyId), eq(familyMemberships.accountId, request.params.accountId))); return reply.code(204).send();
  });
};

async function getActor(options: FamilyRouteOptions, token: string | undefined) {
  return token ? getActorFromToken(options.database, token) : null;
}
