import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { requireChildAccess, requireChildEdit } from "@observation-handbook/domain";
import { getActorFromToken } from "../auth.js";
import type { ApiConfig } from "../config.js";
import type { AppDatabase } from "../db/client.js";
import { children, observationCards, observationProjects } from "../db/schema.js";

type Opt = { database: AppDatabase; config: ApiConfig };
type ProjectBody = { title?: string; objectName?: string; place?: string; question?: string; startedAt?: string; completedAt?: string | null; cadenceDays?: number; focusParts?: string[]; stages?: string[]; conclusion?: string };
export const registerProjectRoutes: FastifyPluginAsync<Opt> = async (app, options) => {
  const actor = async (token?: string) => token ? getActorFromToken(options.database, token) : null;
  const childFor = async (childId: string) => options.database.query.children.findFirst({ where: eq(children.id, childId) });
  app.get<{ Params: { childId: string } }>("/api/children/:childId/projects", async (request, reply) => {
    const current = await actor(request.cookies[options.config.sessionCookie.name]); if (!current) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const child = await childFor(request.params.childId); if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" }); try { requireChildAccess(current, child); } catch { return reply.code(403).send({ code: "FAMILY_ACCESS_DENIED" }); }
    const projects = await options.database.select().from(observationProjects).where(eq(observationProjects.childId, child.id)).orderBy(desc(observationProjects.updatedAt));
    return { projects: projects.map(project => projectView(project)) };
  });
  app.post<{ Params: { childId: string }; Body: ProjectBody }>("/api/children/:childId/projects", async (request, reply) => {
    const current = await actor(request.cookies[options.config.sessionCookie.name]); if (!current) return reply.code(401).send({ code: "AUTH_REQUIRED" }); const child = await childFor(request.params.childId); if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" }); try { requireChildEdit(current, child); } catch { return reply.code(403).send({ code: "CHILD_EDIT_REQUIRED" }); }
    const body = request.body; if (!body.title?.trim() || !body.objectName?.trim() || !body.place?.trim() || !body.question?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(body.startedAt ?? "")) return reply.code(400).send({ code: "PROJECT_DETAILS_REQUIRED" });
    const now = new Date(); const project = { id: randomUUID(), childId: child.id, title: body.title.trim(), objectName: body.objectName.trim(), place: body.place.trim(), question: body.question.trim(), startedAt: body.startedAt!, completedAt: body.completedAt?.trim() || null, cadenceDays: Math.max(1, Math.min(90, body.cadenceDays ?? 7)), focusParts: JSON.stringify(body.focusParts ?? []), stages: JSON.stringify(body.stages ?? []), coverMediaAssetId: null, conclusion: body.conclusion?.trim() ?? "", createdAt: now, updatedAt: now };
    await options.database.insert(observationProjects).values(project); return reply.code(201).send({ project: projectView(project) });
  });
  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/learning", async (request, reply) => {
    const current = await actor(request.cookies[options.config.sessionCookie.name]); if (!current) return reply.code(401).send({ code: "AUTH_REQUIRED" }); const project = await options.database.query.observationProjects.findFirst({ where: eq(observationProjects.id, request.params.projectId) }); if (!project) return reply.code(404).send({ code: "PROJECT_NOT_FOUND" }); const child = await childFor(project.childId); if (!child) return reply.code(404).send({ code: "CHILD_NOT_FOUND" }); try { requireChildAccess(current, child); } catch { return reply.code(403).send({ code: "FAMILY_ACCESS_DENIED" }); }
    const cards = await options.database.select().from(observationCards).where(eq(observationCards.projectId, project.id)).orderBy(observationCards.observedAt);
    const parts = JSON.parse(project.focusParts) as string[]; const observedParts = new Set(cards.map(card => card.observationPart).filter(Boolean)); const cadence = project.cadenceDays * 86400000; const last = cards.at(-1); const prompt = !last ? "从一张照片开始，记录第一次看见它的样子。" : Date.now() - new Date(last.observedAt).getTime() > cadence ? `距离上次记录已超过 ${project.cadenceDays} 天，去看看它有什么变化。` : "下一次可以换一个部位或角度观察。";
    return { project: projectView(project), timeline: cards.map(card => ({ id: card.id, observedAt: card.observedAt, part: card.observationPart, season: card.season, stage: card.stage, change: card.changeNote, evidence: card.evidence, hypothesis: card.hypothesis, text: card.text })), comparison: parts.map(part => ({ part, records: cards.filter(card => card.observationPart === part).length })), missingParts: parts.filter(part => !observedParts.has(part)), prompt };
  });
};
function projectView(project: typeof observationProjects.$inferSelect) { return { ...project, focusParts: JSON.parse(project.focusParts) as string[], stages: JSON.parse(project.stages) as string[] }; }
