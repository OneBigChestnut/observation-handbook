import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import type { ApiConfig } from "./config.js";
import type { AppDatabase } from "./db/client.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerFamilyRoutes } from "./routes/families.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerObservationRoutes } from "./routes/observations.js";

export async function buildApp(database: AppDatabase, config: ApiConfig) {
  const app = Fastify();
  await app.register(cookie);
  await app.register(multipart, { limits: { files: 1, fileSize: 12 * 1024 * 1024 } });
  await app.register(registerAuthRoutes, { database, config });
  await app.register(registerFamilyRoutes, { database, config });
  await app.register(registerMediaRoutes, { database, config });
  await app.register(registerObservationRoutes, { database, config });
  return app;
}
