// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { AuthGate } from "./AuthGate.js";

describe("AuthGate", () => {
  it("shows the login page when the session endpoint returns 401", async () => {
    const loadSession = vi.fn().mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));

    render(<AuthGate loadSession={loadSession}><div>private application</div></AuthGate>);

    expect(await screen.findByRole("heading", { name: "登录观察手册" })).toBeInTheDocument();
    expect(screen.queryByText("private application")).not.toBeInTheDocument();
  });
});
