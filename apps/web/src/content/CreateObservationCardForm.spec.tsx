// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateObservationCardForm } from "./CreateObservationCardForm.js";

describe("CreateObservationCardForm", () => {
  it("uploads selected images then creates a card for the current child", async () => {
    const user = userEvent.setup();
    const uploadMedia = vi.fn().mockResolvedValue({ id: "media-a" });
    const createCard = vi.fn().mockResolvedValue({ id: "card-a" });
    const onCreated = vi.fn();
    render(<CreateObservationCardForm childId="child-a" uploadMedia={uploadMedia} createCard={createCard} onCreated={onCreated} />);

    await user.upload(screen.getByLabelText("选择照片"), new File(["image"], "leaf.jpg", { type: "image/jpeg" }));
    await user.type(screen.getByLabelText("写下发现"), "叶子变黄了");
    await user.type(screen.getByLabelText("标签"), "银杏, 夏末");
    await user.click(screen.getByRole("button", { name: "保存记录" }));

    expect(uploadMedia).toHaveBeenCalledWith("child-a", expect.any(File));
    expect(createCard).toHaveBeenCalledWith("child-a", expect.objectContaining({ text: "叶子变黄了", mediaAssetIds: ["media-a"], tagNames: ["银杏", "夏末"] }));
    expect(onCreated).toHaveBeenCalledOnce();
  });
});
