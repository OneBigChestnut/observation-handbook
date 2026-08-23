import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { createSession, getActorFromToken, removeOtherSessions, removeSession } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { accounts } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../password.js";

type AuthRouteOptions = { database: AppDatabase; config: ApiConfig };

export const registerAuthRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
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
      if (error instanceof Error && error.message === "password must contain at least 12 characters") {
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
