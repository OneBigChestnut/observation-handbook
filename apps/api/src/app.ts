import cookie from "@fastify/cookie";
import Fastify from "fastify";
import type { ApiConfig } from "./config.js";
import type { AppDatabase } from "./db/client.js";
import { registerAuthRoutes } from "./routes/auth.js";

export async function buildApp(database: AppDatabase, config: ApiConfig) {
  const app = Fastify();
  await app.register(cookie);
  await app.register(registerAuthRoutes, { database, config });
  return app;
}
