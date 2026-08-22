import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { createSession, getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { accounts } from "../db/schema.js";
import { verifyPassword } from "../password.js";

type AuthRouteOptions = { database: AppDatabase; config: ApiConfig };

export const registerAuthRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies[options.config.sessionCookie.name];
    const actor = token ? await getActorFromToken(options.database, token) : null;
    if (!actor) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    return actor;
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
