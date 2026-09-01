// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { AuthGate } from "./AuthGate.js";
import { LoginPage } from "./LoginPage.js";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthGate", () => {
  it("shows the login page when the session endpoint returns 401", async () => {
    const loadSession = vi.fn().mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));

    render(<AuthGate loadSession={loadSession}><div>private application</div></AuthGate>);

    expect(await screen.findByRole("heading", { name: "把成长，收进一册温柔的记录。" })).toBeInTheDocument();
    expect(screen.queryByText("private application")).not.toBeInTheDocument();
  });

  it("passes the signed-in account and current family's children into the workspace", async () => {
    const loadWorkspace = vi.fn().mockResolvedValue({
      account: { id: "account-lin", username: "lin", platformRole: "super_admin" },
      families: [{ id: "family-lin", name: "林家档案室", role: "admin", children: [{ id: "child-lele", name: "乐乐" }] }],
    });

    render(<AuthGate loadWorkspace={loadWorkspace}>{workspace => <div>{workspace.account.username} · {workspace.families[0].children[0].name}</div>}</AuthGate>);

    expect(await screen.findByText("lin · 乐乐")).toBeInTheDocument();
  });

  it("returns to the login page when the shell dispatches a logout event", async () => {
    render(<AuthGate loadWorkspace={vi.fn().mockResolvedValue({ account: { id: "a", username: "lin", platformRole: null }, families: [] })}><div>private application</div></AuthGate>);
    expect(await screen.findByText("private application")).toBeInTheDocument();
    window.dispatchEvent(new Event("observation-handbook:logout"));
    expect(await screen.findByRole("heading", { name: "把成长，收进一册温柔的记录。" })).toBeInTheDocument();
  });

  it("does not restore a stale session after a logged-out page is refreshed", async () => {
    sessionStorage.setItem("observation-handbook:logged-out", "1");
    const loadWorkspace = vi.fn().mockResolvedValue({ account: { id: "a", username: "platform", platformRole: "super_admin" }, families: [] });

    render(<AuthGate loadWorkspace={loadWorkspace}><div>private application</div></AuthGate>);

    expect(await screen.findByRole("heading", { name: "把成长，收进一册温柔的记录。" })).toBeInTheDocument();
    expect(loadWorkspace).not.toHaveBeenCalled();
  });

  it("keeps the public example isolated when it is refreshed", async () => {
    const loadWorkspace = vi.fn().mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));
    const { unmount } = render(<AuthGate loadWorkspace={loadWorkspace}>{workspace => <div>{workspace.account.demo ? "demo" : "private"}</div>}</AuthGate>);
    await screen.findByRole("heading", { name: "把成长，收进一册温柔的记录。" });
    await userEvent.setup().click(screen.getByRole("button", { name: /浏览完整示例档案/ }));
    expect(await screen.findByText("demo")).toBeInTheDocument();
    unmount();

    const reloadedWorkspace = vi.fn().mockResolvedValue({ account: { id: "a", username: "platform", platformRole: "super_admin" }, families: [] });
    render(<AuthGate loadWorkspace={reloadedWorkspace}>{workspace => <div>{workspace.account.demo ? "demo" : "private"}</div>}</AuthGate>);

    expect(await screen.findByText("demo")).toBeInTheDocument();
    expect(reloadedWorkspace).not.toHaveBeenCalled();
  });
});

describe("LoginPage", () => {
  it("submits credentials and enters the workspace after a successful login", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ account: { username: "lin" } }), { status: 200, headers: { "content-type": "application/json" } })));

    render(<LoginPage onAuthenticated={onAuthenticated} />);
    await user.type(screen.getByLabelText("账号"), "lin");
    await user.type(screen.getByLabelText("密码"), "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: "进入观察手册" }));

    expect(await screen.findByText("登录成功，正在进入档案室…")).toBeInTheDocument();
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });
});
