export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
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
export type HandbookSummary = { id: string; title: string; introduction: string; startedAt: string; completedAt: string | null; status: "ongoing" | "completed"; cardCount: number; tagCount: number };
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
    const body = await response.json().catch(() => ({ code: "REQUEST_FAILED" })) as { code?: string };
    throw new ApiError(response.status, body.code ?? "REQUEST_FAILED");
  }
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
  createTag: (childId: string, payload: { name: string; color: string }) => request<{ tag: { id: string } }>(`/api/children/${childId}/tags`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.tag),
  createHandbook: (childId: string, payload: CreateHandbookPayload) => request<{ handbook: { id: string } }>(`/api/children/${childId}/handbooks`, { method: "POST", body: JSON.stringify(payload) }).then(response => response.handbook),
  workspace: async (): Promise<Workspace> => {
    const [session, familyResponse] = await Promise.all([apiClient.me(), apiClient.currentFamilies()]);
    return { account: { id: session.accountId, username: session.username, platformRole: session.platformRole }, families: familyResponse.families };
  },
};
