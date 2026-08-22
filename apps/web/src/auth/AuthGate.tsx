import { useEffect, useState, type ReactNode } from "react";
import { ApiError, apiClient } from "../api/client.js";
import { LoginPage } from "./LoginPage.js";

type AuthGateProps = {
  children: ReactNode;
  loadSession?: () => Promise<unknown>;
};

export function AuthGate({ children, loadSession = apiClient.me }: AuthGateProps) {
  const [state, setState] = useState<"loading" | "authenticated" | "anonymous">("loading");

  useEffect(() => {
    void loadSession().then(() => setState("authenticated")).catch(error => {
      setState(error instanceof ApiError && error.status === 401 ? "anonymous" : "anonymous");
    });
  }, [loadSession]);

  if (state === "loading") return <main className="login-page">正在验证登录状态…</main>;
  if (state === "anonymous") return <LoginPage />;
  return <>{children}</>;
}
