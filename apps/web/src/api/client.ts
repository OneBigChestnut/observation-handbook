export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly details: Record<string, unknown> = {}) {
    super(code);
  }
}

export type WorkspaceAccount = {
  id: string;
  username: string;
  platformRole: "super_admin" | "operations_admin" | null;
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
  text: string;
  photos: { id: string; thumbnailUrl: string }[];
  tags: { id: string; name: string; color: string }[];
};

export type TagSummary = { id: string; name: string; color: string; cardCount: number };
export type TemplateSummary = { id: string; name: string; kind: "cover" | "back" | "card_1" | "card_2" | "card_3" | "card_4"; state: "draft" | "published" | "retired"; paperSize: "A5"; orientation: "portrait" };
export type ExportSummary = { id: string; childId: string; handbookId: string; kind: "screen" | "print"; snapshot: string; createdAt: string };
export type HandbookSummary = { id: string; title: string; introduction: string; startedAt: string; completedAt: string | null; status: "ongoing" | "completed"; cardCount: number; tagCount: number; cardIds: string[]; tagIds: string[] };
export type CreateHandbookPayload = {
  title: string;
  introduction: string;
  startedAt: string;
  completedAt?: string;
  tagIds: string[];
  cardIds: string[];
};

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { ...(isFormData ? {} : { "content-type": "application/json" }), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: "REQUEST_FAILED" })) as Record<string, unknown>;
    throw new ApiError(response.status, typeof body.code === "string" ? body.code : "REQUEST_FAILED", body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  me: () => request<{ accountId: string; username: string; platformRole: WorkspaceAccount["platformRole"]; memberships: { familyId: string; role: WorkspaceFamily["role"] }[] }>("/api/auth/me"),
  login: (username: string, password: string) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  currentFamilies: () => request<{ families: WorkspaceFamily[] }>("/api/families/current"),
  cards: (childId: string) => request<{ cards: ObservationCardSummary[] }>(`/api/children/${childId}/cards`).then(response => response.cards),
  tags: (childId: string) => request<{ tags: TagSummary[] }>(`/api/children/${childId}/tags`).then(response => response.tags),
  handbooks: (childId: string) => request<{ handbooks: HandbookSummary[] }>(`/api/children/${childId}/handbooks`).then(response => response.handbooks),
  uploadMedia: (childId: string, file: File) => { const form = new FormData(); form.append("file", file); return request<{ media: { id: string } }>(`/api/children/${childId}/media`, { method: "POST", body: form }).then(response => response.media); },
  createCard: (childId: string, payload: { observedAt: string; text: string; mediaAssetIds: string[]; tagNames: string[] }) => request<{ card: { id: string } }>(`/api/children/${childId}/cards`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.card),
  updateCard: (cardId: string, payload: { observedAt?: string; text?: string }) => request<{ card: ObservationCardSummary }>(`/api/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(payload) }).then(response => response.card),
  archiveCard: (cardId: string) => request<void>(`/api/cards/${cardId}`, { method: "DELETE" }),
  createTag: (childId: string, payload: { name: string; color: string }) => request<{ tag: { id: string } }>(`/api/children/${childId}/tags`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.tag),
  createHandbook: (childId: string, payload: CreateHandbookPayload) => request<{ handbook: { id: string } }>(`/api/children/${childId}/handbooks`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.handbook),
  updateHandbook: (handbookId: string, payload: Partial<CreateHandbookPayload>) => request<{ handbook: HandbookSummary }>(`/api/handbooks/${handbookId}`, { method: "PATCH", body: JSON.stringify(payload) }).then(response => response.handbook),
  templates: (kind: TemplateSummary["kind"]) => request<{ templates: TemplateSummary[] }>(`/api/templates?kind=${kind}`).then(response => response.templates),
  adminTemplates: () => request<{ templates: TemplateSummary[] }>("/api/admin/templates").then(response => response.templates),
  createTemplate: (payload: Pick<TemplateSummary, "name" | "kind" | "state">) => request<{ template: TemplateSummary }>("/api/admin/templates", { method: "POST", body: JSON.stringify(payload) }).then(response => response.template),
  updateTemplate: (id: string, payload: Partial<Pick<TemplateSummary, "name" | "state">>) => request<{ template: TemplateSummary }>(`/api/admin/templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }).then(response => response.template),
  removeTemplate: (id: string) => request<void>(`/api/admin/templates/${id}`, { method: "DELETE" }),
  exports: (childId: string) => request<{ exports: ExportSummary[] }>(`/api/children/${childId}/exports`).then(response => response.exports),
  createExport: (childId: string, payload: { handbookId: string; kind: "screen" | "print" }) => request<{ export: ExportSummary }>(`/api/children/${childId}/exports`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.export),
  removeExport: (id: string) => request<void>(`/api/exports/${id}`, { method: "DELETE" }),
  workspace: async (): Promise<Workspace> => {
    const [session, familyResponse] = await Promise.all([apiClient.me(), apiClient.currentFamilies()]);
    return { account: { id: session.accountId, username: session.username, platformRole: session.platformRole }, families: familyResponse.families };
  },
};
