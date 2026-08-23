import { useEffect, useState, type ReactNode } from "react";
import { apiClient, type Workspace } from "../api/client.js";
import { LoginPage } from "./LoginPage.js";

type AuthGateProps = {
  children: ReactNode | ((workspace: Workspace) => ReactNode);
  loadSession?: () => Promise<unknown>;
  loadWorkspace?: () => Promise<Workspace>;
};

export function AuthGate({ children, loadSession, loadWorkspace }: AuthGateProps) {
  const [state, setState] = useState<"loading" | "authenticated" | "anonymous">("loading");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const refresh = () => {
    setState("loading");
    const loader = loadWorkspace ?? (loadSession ? undefined : apiClient.workspace);
    if (!loader) {
      void loadSession?.().then(() => setState("authenticated")).catch(() => setState("anonymous"));
      return;
    }
    void loader().then(nextWorkspace => {
      setWorkspace(nextWorkspace);
      setState("authenticated");
    }).catch(() => setState("anonymous"));
  };

  useEffect(() => {
    refresh();
  }, [loadSession, loadWorkspace]);

  if (state === "loading") return <main className="login-page">正在验证登录状态…</main>;
  if (state === "anonymous") return <LoginPage onAuthenticated={refresh} />;
  return <>{typeof children === "function" && workspace ? children(workspace) : children}</>;
}
