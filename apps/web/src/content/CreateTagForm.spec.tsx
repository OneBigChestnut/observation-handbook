// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateTagForm } from "./CreateTagForm.js";

describe("CreateTagForm", () => {
  it("creates a tag for the current child and refreshes the page", async () => {
    const user = userEvent.setup();
    const createTag = vi.fn().mockResolvedValue({ id: "tag-a" });
    const onCreated = vi.fn();
    render(<CreateTagForm childId="child-a" createTag={createTag} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("标签名称"), "落叶");
    await user.click(screen.getByRole("button", { name: "创建标签" }));

    expect(createTag).toHaveBeenCalledWith("child-a", { name: "落叶", color: "olive" });
    expect(onCreated).toHaveBeenCalledOnce();
  });
});
