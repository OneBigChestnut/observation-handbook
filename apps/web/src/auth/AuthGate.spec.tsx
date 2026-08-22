// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { AuthGate } from "./AuthGate.js";
import { LoginPage } from "./LoginPage.js";

afterEach(() => cleanup());

describe("AuthGate", () => {
  it("shows the login page when the session endpoint returns 401", async () => {
    const loadSession = vi.fn().mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));

    render(<AuthGate loadSession={loadSession}><div>private application</div></AuthGate>);

    expect(await screen.findByRole("heading", { name: "登录观察手册" })).toBeInTheDocument();
    expect(screen.queryByText("private application")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("登录成功，正在进入档案室…")).toBeInTheDocument();
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });
});
