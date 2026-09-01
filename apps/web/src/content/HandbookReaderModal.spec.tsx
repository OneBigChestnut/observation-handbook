// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HandbookSummary, ObservationCardSummary } from "../api/client.js";
import { HandbookReaderModal } from "./HandbookReaderModal.js";

const handbook: HandbookSummary = { id: "h1", title: "银杏的一年", introduction: "记录树叶的变化。", startedAt: "2026-03-01", completedAt: null, status: "ongoing", cardCount: 2, tagCount: 1, cardIds: ["card-2", "card-1"], tagIds: [] };
const cards: ObservationCardSummary[] = [
  { id: "card-1", observedAt: "2026-03-02", createdAt: "2026-03-02T00:00:00Z", text: "第一片叶子", photos: [{ id: "photo-1", thumbnailUrl: "/leaf-1.jpg" }], tags: [], handbooks: [{ id: "h1", title: "银杏的一年" }], templateLayout: { preset: "standard", safeMarginMm: 10, textAlign: "left", photos: [{ id: "p", x: 10, y: 10, width: 80, height: 50 }], texts: [{ id: "t", x: 10, y: 70, width: 80, height: 10, content: "", color: "#254c3c", fontSize: 16 }] } },
  { id: "card-2", observedAt: "2026-03-03", createdAt: "2026-03-03T00:00:00Z", text: "第二片叶子", photos: [{ id: "photo-2", thumbnailUrl: "/leaf-2.jpg" }], tags: [], handbooks: [{ id: "h1", title: "银杏的一年" }], templateLayout: { preset: "standard", safeMarginMm: 10, textAlign: "left", photos: [{ id: "p", x: 10, y: 10, width: 80, height: 50 }], texts: [{ id: "t", x: 10, y: 70, width: 80, height: 10, content: "", color: "#254c3c", fontSize: 16 }] } },
];

describe("HandbookReaderModal", () => {
  afterEach(cleanup);
  it("shows cover, cards and back as thumbnails and switches the large page", async () => {
    const user = userEvent.setup();
    render(<HandbookReaderModal handbook={handbook} cards={cards} canEdit={false} readOnly onClose={vi.fn()} onSaveOrder={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "银杏的一年" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "封面" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "第 1 张卡片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "第 2 张卡片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "封底" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "第 2 张卡片" }));
    expect(screen.getByText("第二片叶子")).toBeInTheDocument();
  });

  it("uses the export grid for cards without a custom template", async () => {
    const user = userEvent.setup();
    const cardWithoutTemplate = { ...cards[0], id: "fallback-card", templateLayout: undefined };
    render(<HandbookReaderModal handbook={{ ...handbook, cardIds: ["fallback-card"] }} cards={[cardWithoutTemplate]} canEdit={false} readOnly onClose={vi.fn()} onSaveOrder={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "第 1 张卡片" }));
    const largePage = document.querySelector(".handbook-page-large");
    expect(largePage?.querySelector("img")).toHaveStyle({ left: "7%", top: "7%", width: "86%", height: "40%" });
  });

  it("saves a reordered card list without moving cover or back", async () => {
    const user = userEvent.setup();
    const onSaveOrder = vi.fn();
    const onClose = vi.fn();
    render(<HandbookReaderModal handbook={handbook} cards={cards} canEdit onClose={onClose} onSaveOrder={onSaveOrder} />);
    await user.click(screen.getByRole("button", { name: "调整顺序" }));
    expect(screen.getByRole("button", { name: "完成排序" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "第 2 张卡片上移" }));
    await user.click(screen.getByRole("button", { name: "保存顺序" }));
    expect(onSaveOrder).toHaveBeenCalledWith(["card-1", "card-2"]);
    expect(screen.queryByRole("button", { name: "完成排序" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the reader open when completing order adjustment", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HandbookReaderModal handbook={handbook} cards={cards} canEdit onClose={onClose} onSaveOrder={vi.fn().mockResolvedValue(undefined)} />);
    await user.click(screen.getByRole("button", { name: "调整顺序" }));
    await user.click(screen.getByRole("button", { name: "完成排序" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "银杏的一年" })).toBeInTheDocument();
  });

  it("generates a PDF and exposes a download link without closing the reader", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onExport = vi.fn().mockResolvedValue({ id: "export-1" });
    render(<HandbookReaderModal handbook={handbook} cards={cards} canEdit onClose={onClose} onSaveOrder={vi.fn()} onExport={onExport} />);
    await user.click(screen.getByRole("button", { name: "导出 PDF" }));
    await user.click(screen.getByRole("button", { name: "生成文件" }));
    expect(onExport).toHaveBeenCalledWith("h1", "screen");
    expect(await screen.findByRole("status")).toHaveTextContent("已生成 PDF");
    expect(screen.getByRole("link", { name: "下载 PDF" })).toHaveAttribute("href", "/api/exports/export-1/download");
    expect(screen.getByRole("dialog", { name: "银杏的一年" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the export dialog open and explains a service failure", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    render(<HandbookReaderModal handbook={handbook} cards={cards} canEdit onClose={vi.fn()} onSaveOrder={vi.fn()} onExport={onExport} />);
    await user.click(screen.getByRole("button", { name: "导出 PDF" }));
    await user.click(screen.getByRole("button", { name: "生成文件" }));
    expect(await screen.findByRole("status")).toHaveTextContent("无法连接服务");
    expect(screen.getByRole("dialog", { name: "导出观察手册" })).toBeInTheDocument();
  });

  it("closes the small export window when clicking elsewhere in the reader", async () => {
    const user = userEvent.setup();
    render(<HandbookReaderModal handbook={handbook} cards={cards} canEdit onClose={vi.fn()} onSaveOrder={vi.fn()} onExport={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "导出 PDF" }));
    expect(screen.getByRole("dialog", { name: "导出观察手册" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "第 1 张卡片" }));
    expect(screen.queryByRole("dialog", { name: "导出观察手册" })).not.toBeInTheDocument();
  });
});
