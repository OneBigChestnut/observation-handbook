export type ApiConfig = {
  databaseUrl: string;
  sessionCookie: {
    name: string;
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
  };
};

export function getApiConfig(env: NodeJS.ProcessEnv): ApiConfig {
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }

  return {
    databaseUrl: env.DATABASE_URL ?? "file:./dev.db",
    sessionCookie: {
      name: "observation_session",
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
    },
  };
}
