export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}

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
  me: () => request("/api/auth/me"),
};
