export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly details: Record<string, unknown> = {}) {
    super(code);
  }
}

export type WorkspaceAccount = {
  id: string;
  username: string;
  platformRole: "super_admin" | "operations_admin" | null;
  childId?: string | null;
  demo?: boolean;
};

export type WorkspaceChild = { id: string; name: string };

export type WorkspaceFamily = {
  id: string;
  name: string;
  role: "admin" | "reader";
  children: WorkspaceChild[];
};

export type Workspace = { account: WorkspaceAccount; families: WorkspaceFamily[] };

export type ObservationCardSummary = {
  id: string;
  observedAt: string;
  createdAt?: string;
  text: string;
  textBlocks?: string[];
  photos: { id: string; thumbnailUrl: string }[];
  tags: { id: string; name: string; color: string }[];
  templateId?: string | null;
  templateKind?: TemplateSummary["kind"] | null;
  templateLayout?: TemplateLayout | null;
  handbooks?: { id: string; title: string }[];
};

export type TagSummary = { id: string; name: string; color: string; cardCount: number };
export type ObservationProject = { id: string; title: string; objectName: string; place: string; question: string; startedAt: string; completedAt: string | null; cadenceDays: number; focusParts: string[]; stages: string[]; conclusion: string };
export const templateColors = ["#1c5040", "#57806a", "#987a44", "#a46152", "#254c3c"] as const;
export type TemplateColor = typeof templateColors[number];
export type TemplateBox = { id: string; x: number; y: number; width: number; height: number; imageUrl?: string };
export type TemplateText = TemplateBox & { content: string; color: TemplateColor; fontSize: number };
export type TemplateLine = { id: string; x: number; y: number; width: number; color: TemplateColor; thickness?: number };
export type TemplateLayout = { preset: "standard" | "natural"; safeMarginMm: 8 | 10 | 12; textAlign: "left" | "center"; photos?: TemplateBox[]; texts?: TemplateText[]; lines?: TemplateLine[] };
export type TemplateSummary = { id: string; name: string; kind: "cover" | "back" | "card_1" | "card_2" | "card_3" | "card_4"; state: "draft" | "published" | "retired"; paperSize: "A5"; orientation: "portrait"; layout: TemplateLayout };
export type ExportSummary = { id: string; childId: string; handbookId: string; kind: "screen" | "print"; snapshot: string; createdAt: string };
export type PublicationSummary = { id: string; title: string; introduction: string; childName: string; cardCount: number; publishedAt: string; coverThumbnailUrl?: string; cards?: { observedAt: string; text: string; photos?: { id: string; thumbnailUrl: string }[] }[] };
export type HandbookSummary = { id: string; title: string; introduction: string; startedAt: string; completedAt: string | null; status: "ongoing" | "completed"; cardCount: number; tagCount: number; cardIds: string[]; tagIds: string[]; coverTemplateId?: string | null; backTemplateId?: string | null; coverPhotoId?: string | null; backPhotoId?: string | null; publication?: { id: string; publishedAt: string } | null };
export type CreateHandbookPayload = {
  title: string;
  introduction: string;
  startedAt: string;
  completedAt?: string;
  tagIds: string[];
  cardIds: string[];
  coverTemplateId?: string;
  backTemplateId?: string;
  coverPhotoId?: string;
  backPhotoId?: string;
};

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init.body !== null;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { ...(hasBody && !isFormData ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: "REQUEST_FAILED" })) as Record<string, unknown>;
    throw new ApiError(response.status, typeof body.code === "string" ? body.code : "REQUEST_FAILED", body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  me: () => request<{ accountId: string; username: string; platformRole: WorkspaceAccount["platformRole"]; childId?: string | null; memberships: { familyId: string; role: WorkspaceFamily["role"] }[] }>("/api/auth/me"),
  login: (username: string, password: string) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (payload: { username: string; password: string; familyName: string; childName: string }) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  currentFamilies: () => request<{ families: WorkspaceFamily[] }>("/api/families/current"),
  projects: (childId: string) => request<{ projects: ObservationProject[] }>(`/api/children/${childId}/projects`).then(response => response.projects),
  createProject: (childId: string, payload: Omit<ObservationProject, "id" | "completedAt" | "conclusion">) => request<{ project: ObservationProject }>(`/api/children/${childId}/projects`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.project),
  projectLearning: (projectId: string) => request<{ project: ObservationProject; timeline: unknown[]; comparison: { part: string; records: number }[]; missingParts: string[]; prompt: string }>(`/api/projects/${projectId}/learning`),
  familyMembers: (familyId: string) => request<{ members: { accountId: string; username: string; role: WorkspaceFamily["role"] }[] }>(`/api/families/${familyId}/members`).then(response => response.members),
  addFamilyMember: (familyId: string, username: string) => request<{ member: { accountId: string; username: string; role: "reader" } }>(`/api/families/${familyId}/members`, { method: "POST", body: JSON.stringify({ username }) }).then(response => response.member),
  removeFamilyMember: (familyId: string, accountId: string) => request<void>(`/api/families/${familyId}/members/${accountId}`, { method: "DELETE" }),
  addChild: (familyId: string, payload: { name: string; username: string; pin: string }) => request<{ child: { id: string; name: string; username: string } }>(`/api/families/${familyId}/children`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.child),
  removeChild: (familyId: string, childId: string) => request<void>(`/api/families/${familyId}/children/${childId}`, { method: "DELETE" }),
  resetChildPin: (familyId: string, childId: string, pin: string) => request<void>(`/api/families/${familyId}/children/${childId}/pin`, { method: "PATCH", body: JSON.stringify({ pin }) }),
  resetFamilyMemberPassword: (familyId: string, accountId: string, password: string) => request<void>(`/api/families/${familyId}/members/${accountId}/password`, { method: "PATCH", body: JSON.stringify({ password }) }),
  cards: (childId: string) => request<{ cards: ObservationCardSummary[] }>(`/api/children/${childId}/cards`).then(response => response.cards),
  tags: (childId: string) => request<{ tags: TagSummary[] }>(`/api/children/${childId}/tags`).then(response => response.tags),
  handbooks: (childId: string) => request<{ handbooks: HandbookSummary[] }>(`/api/children/${childId}/handbooks`).then(response => response.handbooks),
  uploadMedia: (childId: string, file: File) => { const form = new FormData(); form.append("file", file); return request<{ media: { id: string } }>(`/api/children/${childId}/media`, { method: "POST", body: form }).then(response => response.media); },
  createCard: (childId: string, payload: { projectId?: string; observedAt: string; text: string; textBlocks?: string[]; mediaAssetIds: string[]; tagIds: string[]; handbookIds?: string[]; templateId?: string; observationPart?: string; season?: string; stage?: string; changeNote?: string; evidence?: string; hypothesis?: string }) => request<{ card: { id: string } }>(`/api/children/${childId}/cards`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.card),
  updateCard: (cardId: string, payload: { observedAt?: string; text?: string; textBlocks?: string[]; mediaAssetIds?: string[]; tagIds?: string[]; handbookIds?: string[]; templateId?: string }) => request<{ card: ObservationCardSummary }>(`/api/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(payload) }).then(response => response.card),
  archiveCard: (cardId: string) => request<void>(`/api/cards/${cardId}`, { method: "DELETE" }),
  createTag: (childId: string, payload: { name: string; color: string }) => request<{ tag: TagSummary }>(`/api/children/${childId}/tags`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.tag),
  updateTag: (childId: string, tagId: string, payload: { name?: string; color?: string }) => request<{ tag: TagSummary }>(`/api/children/${childId}/tags/${tagId}`, { method: "PATCH", body: JSON.stringify(payload) }).then(response => response.tag),
  removeTag: (childId: string, tagId: string) => request<void>(`/api/children/${childId}/tags/${tagId}`, { method: "DELETE" }),
  createHandbook: (childId: string, payload: CreateHandbookPayload) => request<{ handbook: { id: string } }>(`/api/children/${childId}/handbooks`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.handbook),
  updateHandbook: (handbookId: string, payload: Partial<CreateHandbookPayload>) => request<{ handbook: HandbookSummary }>(`/api/handbooks/${handbookId}`, { method: "PATCH", body: JSON.stringify(payload) }).then(response => response.handbook),
  templates: (kind: TemplateSummary["kind"]) => request<{ templates: TemplateSummary[] }>(`/api/templates?kind=${kind}`).then(response => response.templates),
  adminTemplates: () => request<{ templates: TemplateSummary[] }>("/api/admin/templates").then(response => response.templates),
  createTemplate: (payload: Pick<TemplateSummary, "name" | "kind" | "state" | "layout">) => request<{ template: TemplateSummary }>("/api/admin/templates", { method: "POST", body: JSON.stringify(payload) }).then(response => response.template),
  updateTemplate: (id: string, payload: Partial<Pick<TemplateSummary, "name" | "state" | "layout">>) => request<{ template: TemplateSummary }>(`/api/admin/templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }).then(response => response.template),
  removeTemplate: (id: string) => request<void>(`/api/admin/templates/${id}`, { method: "DELETE" }),
  exports: (childId: string) => request<{ exports: ExportSummary[] }>(`/api/children/${childId}/exports`).then(response => response.exports),
  createExport: (childId: string, payload: { handbookId: string; kind: "screen" | "print" }) => request<{ export: ExportSummary }>(`/api/children/${childId}/exports`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.export),
  removeExport: (id: string) => request<void>(`/api/exports/${id}`, { method: "DELETE" }),
  publications: () => request<{ publications: PublicationSummary[] }>("/api/publications").then(response => response.publications),
  publication: (id: string) => request<{ publication: PublicationSummary }>(`/api/publications/${id}`).then(response => response.publication),
  publishHandbook: (id: string) => request<{ publication: PublicationSummary }>(`/api/handbooks/${id}/publish`, { method: "POST" }).then(response => response.publication),
  withdrawPublication: (id: string) => request<void>(`/api/publications/${id}/withdraw`, { method: "POST" }),
  reportPublication: (id: string, reason: string) => request<{ reported: true }>(`/api/publications/${id}/report`, { method: "POST", body: JSON.stringify({ reason }) }),
  takedownPublication: (id: string) => request<void>(`/api/admin/publications/${id}/takedown`, { method: "POST" }),
  workspace: async (): Promise<Workspace> => {
    const [session, familyResponse] = await Promise.all([apiClient.me(), apiClient.currentFamilies()]);
    return { account: { id: session.accountId, username: session.username, platformRole: session.platformRole, childId: session.childId ?? null }, families: familyResponse.families };
  },
};
