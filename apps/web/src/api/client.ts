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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
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
  workspace: async (): Promise<Workspace> => {
    const [session, familyResponse] = await Promise.all([apiClient.me(), apiClient.currentFamilies()]);
    return { account: { id: session.accountId, username: session.username, platformRole: session.platformRole }, families: familyResponse.families };
  },
};
