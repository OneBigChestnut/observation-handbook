import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createSession, getActorFromToken, removeOtherSessions, removeSession } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../password.js";

type AuthRouteOptions = { database: AppDatabase; config: ApiConfig };

export const registerAuthRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
  app.post<{ Body: { username?: string; password?: string; familyName?: string; childName?: string } }>("/api/auth/register", async (request, reply) => {
    const username = request.body.username?.trim(); const password = request.body.password; const familyName = request.body.familyName?.trim(); const childName = request.body.childName?.trim();
    if (!username || !password || !familyName || !childName) return reply.code(400).send({ code: "REGISTRATION_DETAILS_REQUIRED" });
    if (await options.database.query.accounts.findFirst({ where: eq(accounts.username, username) })) return reply.code(409).send({ code: "USERNAME_TAKEN" });
    let passwordHash: string;
    try { passwordHash = await hashPassword(password); } catch (error) { return reply.code(400).send({ code: error instanceof Error && error.message === "password must contain at least 8 characters" ? "AUTH_INVALID_PASSWORD" : "REGISTRATION_INVALID" }); }
    const now = new Date(); const account = { id: randomUUID(), username, passwordHash, platformRole: null, createdAt: now }; const family = { id: randomUUID(), name: familyName, createdAt: now }; const child = { id: randomUUID(), familyId: family.id, name: childName, createdAt: now };
    options.database.transaction(transaction => { transaction.insert(accounts).values(account).run(); transaction.insert(families).values(family).run(); transaction.insert(familyMemberships).values({ accountId: account.id, familyId: family.id, role: "admin" }).run(); transaction.insert(children).values(child).run(); });
    const session = await createSession(options.database, account.id);
    reply.setCookie(options.config.sessionCookie.name, session.rawToken, { httpOnly: options.config.sessionCookie.httpOnly, sameSite: options.config.sessionCookie.sameSite, secure: options.config.sessionCookie.secure, path: options.config.sessionCookie.path, expires: session.expiresAt });
    return reply.code(201).send({ account: { id: account.id, username: account.username, platformRole: null }, family: { id: family.id, name: family.name, role: "admin" }, child: { id: child.id, name: child.name } });
  });

  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies[options.config.sessionCookie.name];
    const actor = token ? await getActorFromToken(options.database, token) : null;
    if (!actor || !token) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    return actor;
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[options.config.sessionCookie.name];
    if (token) await removeSession(options.database, token);
    reply.clearCookie(options.config.sessionCookie.name, { path: options.config.sessionCookie.path });
    return reply.code(204).send();
  });

  app.post<{ Body: { currentPassword?: string; nextPassword?: string } }>("/api/auth/change-password", async (request, reply) => {
    const token = request.cookies[options.config.sessionCookie.name];
    const actor = token ? await getActorFromToken(options.database, token) : null;
    if (!actor || !token) return reply.code(401).send({ code: "AUTH_REQUIRED" });

    const account = await options.database.query.accounts.findFirst({ where: eq(accounts.id, actor.accountId) });
    if (!account || !request.body.currentPassword || !(await verifyPassword(request.body.currentPassword, account.passwordHash))) {
      return reply.code(401).send({ code: "AUTH_INVALID_CREDENTIALS" });
    }

    try {
      await options.database.update(accounts).set({ passwordHash: await hashPassword(request.body.nextPassword ?? "") }).where(eq(accounts.id, account.id));
    } catch (error) {
      if (error instanceof Error && error.message === "password must contain at least 8 characters") {
        return reply.code(400).send({ code: "AUTH_INVALID_PASSWORD" });
      }
      throw error;
    }
    await removeOtherSessions(options.database, account.id, token);
    return reply.code(204).send();
  });

  app.post<{ Body: { username?: string; password?: string } }>("/api/auth/login", async (request, reply) => {
    const username = request.body.username?.trim();
    const password = request.body.password;
    const account = username ? await options.database.query.accounts.findFirst({ where: eq(accounts.username, username) }) : undefined;

    if (!account || !password || !(await verifyPassword(password, account.passwordHash))) {
      return reply.code(401).send({ code: "AUTH_INVALID_CREDENTIALS" });
    }

    const session = await createSession(options.database, account.id);
    reply.setCookie(options.config.sessionCookie.name, session.rawToken, {
      httpOnly: options.config.sessionCookie.httpOnly,
      sameSite: options.config.sessionCookie.sameSite,
      secure: options.config.sessionCookie.secure,
      path: options.config.sessionCookie.path,
      expires: session.expiresAt,
    });
    return { account: { id: account.id, username: account.username, platformRole: account.platformRole } };
  });
};
