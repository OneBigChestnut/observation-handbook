// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateObservationCardForm } from "./CreateObservationCardForm.js";

describe("CreateObservationCardForm", () => {
  afterEach(cleanup);
  it("uploads selected images then creates a card for the current child", async () => {
    const user = userEvent.setup();
    const uploadMedia = vi.fn().mockResolvedValue({ id: "media-a" });
    const createCard = vi.fn().mockResolvedValue({ id: "card-a" });
    const onCreated = vi.fn();
    render(<CreateObservationCardForm childId="child-a" uploadMedia={uploadMedia} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} createCard={createCard} onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: /更换版式/ }));
    expect(screen.getByRole("dialog", { name: "选择卡片版式" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "选择模板：单图日记" }));
    expect(screen.getByRole("dialog", { name: "选择卡片版式" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认选择" }));
    expect(screen.queryByRole("dialog", { name: "选择卡片版式" })).not.toBeInTheDocument();
    expect(screen.getByText("＋ 照片 1")).toHaveStyle({ position: "absolute" });
    expect(screen.getByText("＋ 照片 1").closest(".fixed-card-canvas")).toHaveStyle({ position: "relative" });
    expect(document.querySelector(".template-selected-summary")).not.toBeInTheDocument();
    await user.upload(screen.getByLabelText("选择照片"), new File(["image"], "leaf.jpg", { type: "image/jpeg" }));
    expect(screen.getByText("＋ 照片 1").closest(".fixed-card-photo-slot")).toHaveStyle({ left: "10%", top: "10%", width: "80%", height: "58%" });
    // Text is rendered as the final card appearance until the child taps it.
    await user.click(screen.getByText("我发现了什么？"));
    await user.type(screen.getByRole("textbox", { name: "写下发现" }), "叶子变黄了");
    await user.click(screen.getByRole("button", { name: "收进我的观察册 ✦" }));

    expect(uploadMedia).toHaveBeenCalledWith("child-a", expect.any(File));
    expect(createCard).toHaveBeenCalledWith("child-a", expect.objectContaining({ text: "叶子变黄了", mediaAssetIds: ["media-a"], tagIds: [], templateId: "card-one" }));
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it("loads an existing card into the fixed workbench and saves its text", async () => {
    const user = userEvent.setup();
    const updateCard = vi.fn().mockResolvedValue({ id: "card-a" });
    render(<CreateObservationCardForm childId="child-a" existingCard={{ id: "card-a", observedAt: "2026-08-22", createdAt: "2026-08-22T09:00:00.000Z", text: "原来的发现", photos: [{ id: "media-a", thumbnailUrl: "/old-photo.jpg" }], tags: [], templateId: "card-one", templateKind: "card_1", templateLayout: { preset: "standard", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 10, width: 80, height: 58 }], texts: [{ id: "text-1", content: "我发现了什么？", x: 10, y: 74, width: 80, height: 14, fontSize: 12, color: "#254c3c" }] }, handbooks: [] }} updateCard={updateCard} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: { preset: "standard", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 10, width: 80, height: 58 }], texts: [{ id: "text-1", content: "我发现了什么？", x: 10, y: 74, width: 80, height: 14, fontSize: 12, color: "#254c3c" }] } }])} onCreated={vi.fn()} />);
    await user.click(await screen.findByText("原来的发现"));
    expect(await screen.findByDisplayValue("原来的发现")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "第 1 张待保存照片" })).toHaveAttribute("src", "/old-photo.jpg");
    await user.clear(screen.getByDisplayValue("原来的发现"));
    await user.type(screen.getByRole("textbox", { name: "写下发现" }), "修改后的发现");
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(updateCard).toHaveBeenCalledWith("card-a", { text: "修改后的发现", textBlocks: ["修改后的发现"], mediaAssetIds: ["media-a"], tagIds: [], handbookIds: [], templateId: "card-one" });
  });

  it("uses a separate compact viewer in read-only mode", async () => {
    render(<CreateObservationCardForm childId="child-a" readOnly existingCard={{ id: "card-a", observedAt: "2026-08-22", text: "只读发现", photos: [{ id: "media-a", thumbnailUrl: "/old-photo.jpg" }], tags: [], templateKind: "card_1", handbooks: [] }} onCreated={vi.fn()} onCancel={vi.fn()} loadTemplates={vi.fn().mockResolvedValue([])} />);
    expect(await screen.findByRole("region", { name: "观察卡只读查看" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "观察卡编辑台" })).not.toBeInTheDocument();
  });

  it("opens existing tag suggestions from the hash input", async () => {
    const user = userEvent.setup();
    render(<CreateObservationCardForm childId="child-a" loadTags={vi.fn().mockResolvedValue([{ id: "tag-river", name: "小河的一年", color: "olive", cardCount: 2 }])} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "搜索标签" }), "#");
    expect(screen.getByRole("listbox", { name: "标签候选" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加标签" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("option", { name: /小河的一年/ })).toBeInTheDocument());
    await user.click(screen.getByRole("option", { name: /小河的一年/ }));
    expect(screen.getByRole("button", { name: "#小河的一年" })).toBeInTheDocument();
  });

  it("saves selected tags by their stable IDs", async () => {
    const user = userEvent.setup();
    const updateCard = vi.fn().mockResolvedValue({ id: "card-a" });
    render(<CreateObservationCardForm childId="child-a" existingCard={{ id: "card-a", observedAt: "2026-08-22", text: "原来的发现", photos: [{ id: "media-a", thumbnailUrl: "/old-photo.jpg" }], tags: [], templateId: "card-one", templateKind: "card_1", templateLayout: { preset: "standard", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 10, width: 80, height: 58 }], texts: [{ id: "text-1", content: "我发现了什么？", x: 10, y: 74, width: 80, height: 14, fontSize: 12, color: "#254c3c" }] }, handbooks: [] }} updateCard={updateCard} loadTags={vi.fn().mockResolvedValue([{ id: "tag-river", name: "小河", color: "olive", cardCount: 2 }])} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "搜索标签" }), "#");
    await user.click(await screen.findByRole("option", { name: /#小河/ }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(updateCard).toHaveBeenCalledWith("card-a", expect.objectContaining({ tagIds: ["tag-river"] }));
  });

  it("asks for confirmation before removing a selected tag and closes on outside click", async () => {
    const user = userEvent.setup();
    render(<CreateObservationCardForm childId="child-a" existingCard={{ id: "card-a", observedAt: "2026-08-22", text: "发现", photos: [{ id: "media-a", thumbnailUrl: "/old-photo.jpg" }], tags: [{ id: "tag-river", name: "小河", color: "olive" }], templateId: "card-one", templateKind: "card_1", templateLayout: { preset: "standard", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 10, width: 80, height: 58 }], texts: [{ id: "text-1", content: "我发现了什么？", x: 10, y: 74, width: 80, height: 14, fontSize: 12, color: "#254c3c" }] }, handbooks: [] }} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} />);
    const tag = await screen.findByRole("button", { name: "#小河" });
    await user.click(tag);
    expect(screen.getByRole("dialog", { name: "删除标签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "#小河" })).toBeInTheDocument();
    await user.click(screen.getByText("观察手册"));
    expect(screen.queryByRole("dialog", { name: "删除标签" })).not.toBeInTheDocument();
    await user.click(tag);
    await user.click(screen.getByRole("button", { name: "确认删除标签" }));
    expect(screen.queryByRole("button", { name: "#小河" })).not.toBeInTheDocument();
  });

  it("creates a new tag explicitly, then selects it for the card", async () => {
    const user = userEvent.setup();
    const createTag = vi.fn().mockResolvedValue({ id: "tag-tomato", name: "番茄", color: "terracotta", cardCount: 0 });
    render(<CreateObservationCardForm childId="child-a" createTag={createTag} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "搜索标签" }), "#番茄");
    await user.click(screen.getByRole("button", { name: "新建标签「番茄」" }));
    await user.click(screen.getByRole("button", { name: "创建并选中" }));

    expect(createTag).toHaveBeenCalledWith("child-a", { name: "番茄", color: "olive" });
    expect(screen.getByRole("button", { name: "#番茄" })).toBeInTheDocument();
  });

  it("archives an existing card from the edit workbench after confirmation", async () => {
    const user = userEvent.setup();
    const archiveCard = vi.fn().mockResolvedValue(undefined);
    const onArchived = vi.fn();
    render(<CreateObservationCardForm childId="child-a" existingCard={{ id: "card-a", observedAt: "2026-08-22", text: "发现", photos: [{ id: "media-a", thumbnailUrl: "/old-photo.jpg" }], tags: [], templateId: "card-one", templateKind: "card_1", templateLayout: { preset: "standard", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 10, width: 80, height: 58 }], texts: [{ id: "text-1", content: "我发现了什么？", x: 10, y: 74, width: 80, height: 14, fontSize: 12, color: "#254c3c" }] }, handbooks: [] }} archiveCard={archiveCard} onArchived={onArchived} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "归档卡片" }));
    expect(screen.getByRole("dialog", { name: "确认归档卡片" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认归档" }));
    await waitFor(() => expect(archiveCard).toHaveBeenCalledWith("card-a"));
    expect(onArchived).toHaveBeenCalledOnce();
  });

  it("refreshes handbook choices without resetting the card draft", async () => {
    const user = userEvent.setup();
    const loadHandbooks = vi.fn().mockResolvedValue([{ id: "handbook-a", title: "我看春天", cardCount: 0 }]);
    const { rerender } = render(<CreateObservationCardForm childId="child-a" loadHandbooks={loadHandbooks} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} handbookRefreshKey={0} />);
    await user.click(await screen.findByText("我发现了什么？"));
    await user.type(screen.getByRole("textbox", { name: "写下发现" }), "正在记录的发现");
    rerender(<CreateObservationCardForm childId="child-a" loadHandbooks={loadHandbooks} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} handbookRefreshKey={1} />);
    expect(await screen.findByDisplayValue("正在记录的发现")).toBeInTheDocument();
    await waitFor(() => expect(loadHandbooks).toHaveBeenCalledTimes(2));
  });

  it("explains when a multi-photo template is missing photos before uploading", async () => {
    const user = userEvent.setup();
    const uploadMedia = vi.fn().mockResolvedValue({ id: "media-a" });
    const createCard = vi.fn().mockResolvedValue({ id: "card-a" });
    render(<CreateObservationCardForm childId="child-a" uploadMedia={uploadMedia} createCard={createCard} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-two", name: "双图对照", kind: "card_2", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /更换版式/ }));
    await user.click(screen.getByRole("button", { name: "两张照片" }));
    await user.click(screen.getByRole("button", { name: "选择模板：双图对照" }));
    await user.click(screen.getByRole("button", { name: "确认选择" }));
    await user.upload(screen.getByLabelText("选择照片"), new File(["image"], "leaf.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "收进我的观察册 ✦" }));
    expect(await screen.findByText("这个版式需要 2 张照片，还差 1 张。")).toBeInTheDocument();
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(createCard).not.toHaveBeenCalled();
  });

  it("allows adding the card to more than one handbook", async () => {
    const user = userEvent.setup();
    const createCard = vi.fn().mockResolvedValue({ id: "card-a" });
    const uploadMedia = vi.fn().mockResolvedValue({ id: "media-a" });
    render(<CreateObservationCardForm childId="child-a" uploadMedia={uploadMedia} createCard={createCard} loadHandbooks={vi.fn().mockResolvedValue([{ id: "h1", title: "春天", cardCount: 1 }, { id: "h2", title: "小河", cardCount: 2 }])} loadTemplates={vi.fn().mockResolvedValue([{ id: "card-one", name: "单图日记", kind: "card_1", state: "published", paperSize: "A5", orientation: "portrait", layout: undefined as never }])} onCreated={vi.fn()} />);
    await user.upload(screen.getByLabelText("选择照片"), new File(["image"], "leaf.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("checkbox", { name: "春天" }));
    await user.click(screen.getByRole("checkbox", { name: "小河" }));
    await user.click(screen.getByRole("button", { name: "收进我的观察册 ✦" }));
    expect(createCard).toHaveBeenCalledWith("child-a", expect.objectContaining({ handbookIds: ["h1", "h2"] }));
  });
});
