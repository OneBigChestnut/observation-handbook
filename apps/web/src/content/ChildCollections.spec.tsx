// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { ChildHandbookList, ChildTagList } from "./ChildCollections.js";

afterEach(cleanup);

describe("child content collections", () => {
  it("loads tag and handbook summaries for the current child", async () => {
    const loadTags = vi.fn().mockResolvedValue([{ id: "tag-a", name: "银杏", color: "ochre", cardCount: 3 }]);
    const loadHandbooks = vi.fn().mockResolvedValue([{ id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing", cardCount: 3, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] }]);

    render(<><ChildTagList childId="child-a" loadTags={loadTags} /><ChildHandbookList childId="child-a" loadHandbooks={loadHandbooks} loadCards={vi.fn().mockResolvedValue([])} /></>);

    expect(await screen.findByText("银杏")).toBeInTheDocument();
    expect(await screen.findByText("银杏的一年")).toBeInTheDocument();
    expect(loadTags).toHaveBeenCalledWith("child-a");
    expect(loadHandbooks).toHaveBeenCalledWith("child-a");
  });

  it("allows an administrator to publish a handbook and opens the reader", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] };
    const publishHandbook = vi.fn().mockResolvedValue({ id: "publication-a" });
    render(<ChildHandbookList childId="child-a" canEdit loadHandbooks={vi.fn().mockResolvedValue([handbook])} loadCards={vi.fn().mockResolvedValue([])} publishHandbook={publishHandbook} />);

    fireEvent.click(await screen.findByRole("button", { name: "发布到公共空间" }));
    expect(publishHandbook).toHaveBeenCalledWith("handbook-a");
    expect(await screen.findByRole("status")).toHaveTextContent("已发布到公共空间");
    fireEvent.click(screen.getByRole("button", { name: "打开整本手册 →" }));
    expect(await screen.findByRole("dialog", { name: "银杏的一年" })).toBeInTheDocument();
  });

  it("does not expose publishing to child editors without family-admin permission", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] };
    render(<ChildHandbookList childId="child-a" canEdit canPublish={false} loadHandbooks={vi.fn().mockResolvedValue([handbook])} loadCards={vi.fn().mockResolvedValue([])} />);

    await screen.findByText("银杏的一年");
    expect(screen.queryByRole("button", { name: "发布到公共空间" })).not.toBeInTheDocument();
  });

  it("explains authorization failures when publishing", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] };
    const publishHandbook = vi.fn().mockRejectedValue(new ApiError(403, "FAMILY_ADMIN_REQUIRED"));
    render(<ChildHandbookList childId="child-a" canEdit loadHandbooks={vi.fn().mockResolvedValue([handbook])} loadCards={vi.fn().mockResolvedValue([])} publishHandbook={publishHandbook} />);

    fireEvent.click(await screen.findByRole("button", { name: "发布到公共空间" }));
    expect(await screen.findByRole("status")).toHaveTextContent("只有家庭管理员可以发布");
  });

  it("shows the public status and lets a family administrator withdraw it", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"], publication: { id: "publication-a", publishedAt: "2026-08-30T00:00:00.000Z" } };
    const withdrawPublication = vi.fn().mockResolvedValue(undefined);
    render(<ChildHandbookList childId="child-a" canEdit loadHandbooks={vi.fn().mockResolvedValue([handbook])} loadCards={vi.fn().mockResolvedValue([])} withdrawPublication={withdrawPublication} />);

    expect(await screen.findByText("已发布到公共空间")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "撤销发布" }));
    expect(withdrawPublication).toHaveBeenCalledWith("publication-a");
  });

  it("does not show handbook mutation controls to a reader", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] };
    render(<ChildHandbookList childId="child-a" loadHandbooks={vi.fn().mockResolvedValue([handbook])} loadCards={vi.fn().mockResolvedValue([])} />);
    await screen.findByText("银杏的一年");
    expect(screen.queryByRole("button", { name: "完成观察" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "调整顺序" })).not.toBeInTheDocument();
  });

  it("shows a photographed handbook preview and its collected cards", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: "2026-10-10", status: "completed" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] };
    const loadCards = vi.fn().mockResolvedValue([
      { id: "card-a", observedAt: "2026-03-10", text: "第一片叶子", photos: [{ id: "media-a", thumbnailUrl: "/media-a.jpg" }], tags: [] },
      { id: "card-b", observedAt: "2026-10-10", text: "最后一片叶子", photos: [{ id: "media-b", thumbnailUrl: "/media-b.jpg" }], tags: [] },
    ]);
    render(<ChildHandbookList childId="child-a" loadHandbooks={vi.fn().mockResolvedValue([handbook])} loadCards={loadCards} />);

    expect(await screen.findByRole("img", { name: "银杏的一年封面" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开整本手册 →" }));
    expect(await screen.findByRole("dialog", { name: "银杏的一年" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "第 1 张卡片" })).toBeInTheDocument();
  });

  it("uses the handbook's selected cover photo instead of the first card photo", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"], coverPhotoId: "media-b", backPhotoId: "media-a" };
    const cards = [
      { id: "card-a", observedAt: "2026-03-10", text: "第一片叶子", photos: [{ id: "media-a", thumbnailUrl: "/media-a.jpg" }], tags: [] },
      { id: "card-b", observedAt: "2026-10-10", text: "最后一片叶子", photos: [{ id: "media-b", thumbnailUrl: "/media-b.jpg" }], tags: [] },
    ];
    render(<ChildHandbookList childId="child-a" loadHandbooks={vi.fn().mockResolvedValue([handbook])} loadCards={vi.fn().mockResolvedValue(cards)} />);

    expect(await screen.findByRole("img", { name: "银杏的一年封面" })).toHaveAttribute("src", "/media-b.jpg");
  });

  it("distinguishes handbook loading errors from an empty handbook list and retries", async () => {
    const loadHandbooks = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([]);
    render(<ChildHandbookList childId="child-a" loadHandbooks={loadHandbooks} loadCards={vi.fn().mockResolvedValue([])} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("观察手册加载失败");
    fireEvent.click(screen.getByRole("button", { name: "重试加载观察手册" }));
    expect(loadHandbooks).toHaveBeenCalledTimes(2);
  });

  it("lets a family administrator manage unused tags but protects tags already in use", async () => {
    const updateTag = vi.fn().mockResolvedValue({ id: "tag-a", name: "新名字", color: "forest", cardCount: 0 });
    const removeTag = vi.fn().mockResolvedValue(undefined);
    render(<ChildTagList childId="child-a" canEdit loadTags={vi.fn().mockResolvedValue([{ id: "tag-a", name: "银杏", color: "ochre", cardCount: 0 }, { id: "tag-b", name: "小河", color: "olive", cardCount: 2 }])} updateTag={updateTag} removeTag={removeTag} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "编辑标签 银杏" }));
    expect(screen.getByRole("dialog", { name: "编辑标签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除标签 银杏" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除标签 小河" })).not.toBeInTheDocument();
  });
});
