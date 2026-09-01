import { useEffect, useState, type ReactNode } from "react";
import { apiClient, type Workspace } from "../api/client.js";
import { LoginPage } from "./LoginPage.js";
import { DEMO_CHILD_ID, DEMO_FAMILY_ID } from "../demo/demoData.js";

const LOGGED_OUT_KEY = "observation-handbook:logged-out";
const DEMO_MODE_KEY = "observation-handbook:demo-mode";

type AuthGateProps = {
  children: ReactNode | ((workspace: Workspace) => ReactNode);
  loadSession?: () => Promise<unknown>;
  loadWorkspace?: () => Promise<Workspace>;
};

export function AuthGate({ children, loadSession, loadWorkspace }: AuthGateProps) {
  const [state, setState] = useState<"loading" | "authenticated" | "anonymous" | "demo">("loading");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const refresh = () => {
    sessionStorage.removeItem(LOGGED_OUT_KEY);
    sessionStorage.removeItem(DEMO_MODE_KEY);
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
    if (sessionStorage.getItem(DEMO_MODE_KEY) === "1") {
      setState("demo");
      return;
    }
    if (sessionStorage.getItem(LOGGED_OUT_KEY) === "1") {
      setState("anonymous");
      return;
    }
    refresh();
  }, [loadSession, loadWorkspace]);

  useEffect(() => {
    const onLogout = () => {
      sessionStorage.setItem(LOGGED_OUT_KEY, "1");
      sessionStorage.removeItem(DEMO_MODE_KEY);
      setWorkspace(null);
      setState("anonymous");
    };
    window.addEventListener("observation-handbook:logout", onLogout);
    return () => window.removeEventListener("observation-handbook:logout", onLogout);
  }, []);

  if (state === "loading") return <main className="login-page">正在验证登录状态…</main>;
  if (state === "anonymous") return <LoginPage onAuthenticated={refresh} onDemo={() => {
    sessionStorage.removeItem(LOGGED_OUT_KEY);
    sessionStorage.setItem(DEMO_MODE_KEY, "1");
    void apiClient.logout().catch(() => undefined);
    setState("demo");
  }} />;
  if (state === "demo") {
    const demoWorkspace: Workspace = { account: { id: "demo-account", username: "公开示例", platformRole: null, childId: DEMO_CHILD_ID, demo: true }, families: [{ id: DEMO_FAMILY_ID, name: "公开示例档案", role: "reader", children: [{ id: DEMO_CHILD_ID, name: "乐乐" }] }] };
    return <>{typeof children === "function" ? children(demoWorkspace) : children}</>;
  }
  return <>{typeof children === "function" && workspace ? children(workspace) : children}</>;
}
