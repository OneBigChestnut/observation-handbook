// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TemplateManagementPage } from "./TemplateManagementPage.js";

const baseLayout = { preset: "standard", safeMarginMm: 10, textAlign: "left" as const };
const cover = { id: "cover-a", name: "林间封面", kind: "cover" as const, state: "published" as const, paperSize: "A5" as const, orientation: "portrait" as const, layout: baseLayout };
const secondCover = { ...cover, id: "cover-b", name: "留白封面" };
const singleCard = { ...cover, id: "card-a", name: "单图日记", kind: "card_1" as const };

it("groups templates by kind and opens an editor for the selected kind", async () => {
  render(<TemplateManagementPage loadTemplates={vi.fn().mockResolvedValue([cover, secondCover, singleCard])} createTemplate={vi.fn()} updateTemplate={vi.fn()} publishTemplate={vi.fn()} removeTemplate={vi.fn()} />);

  expect(await screen.findByRole("tab", { name: "封面 2" })).toBeInTheDocument();
  expect(document.querySelectorAll(".template-thumbnail-preview")).toHaveLength(2);
  expect(screen.getByRole("tab", { name: "1 张图 1" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "封底 0" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "1 张图 1" }));
  expect(screen.getByText("单图日记")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "新增模板" }));
  expect(screen.getByRole("dialog", { name: "编辑 1 张图模板" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "添加文字框" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "添加装饰线" })).toBeInTheDocument();
  const editor = screen.getByRole("dialog");
  expect(editor.querySelector(".canvas-photo")).toHaveClass("canvas-photo");
  expect(screen.getByLabelText("调整照片格 1大小")).toBeInTheDocument();
  expect(screen.queryByLabelText("照片横向位置")).not.toBeInTheDocument();
  fireEvent.click(editor.querySelector('[aria-label="文字框"]')!);
  expect(screen.getByLabelText("文字字号")).toBeInTheDocument();
  expect(screen.getByLabelText("文字字号")).toHaveValue("12");
  expect(screen.getByRole("button", { name: "删除当前选中" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "＋ 增加照片框" }));
  expect(screen.getByRole("button", { name: "照片格 2" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "添加装饰线" }));
  expect(screen.getByRole("button", { name: "装饰线粗细 1" })).toBeInTheDocument();
  expect(screen.getByLabelText("调整装饰线起点")).toBeInTheDocument();
  expect(screen.getByLabelText("调整装饰线终点")).toBeInTheDocument();
});

it("shows a recoverable message instead of a blank page when the template directory fails to load", async () => {
  render(<TemplateManagementPage loadTemplates={vi.fn().mockRejectedValue(new Error("offline"))} createTemplate={vi.fn()} updateTemplate={vi.fn()} publishTemplate={vi.fn()} removeTemplate={vi.fn()} />);

  const error = await screen.findByText(/模板目录暂时无法读取/);
  expect(error).toBeInTheDocument();
  expect(error.querySelector("button")?.textContent).toBe("重新读取");
});

it("submits the edited layout when saving a new template", async () => {
  const createTemplate = vi.fn().mockResolvedValue({ ...cover, id: "new-cover", state: "draft" });
  render(<TemplateManagementPage loadTemplates={vi.fn().mockResolvedValue([])} createTemplate={createTemplate} updateTemplate={vi.fn()} publishTemplate={vi.fn()} removeTemplate={vi.fn()} />);
  const management = (await screen.findAllByLabelText("模板管理")).at(-1)!;
  fireEvent.click(within(management).getAllByRole("button", { name: "新增模板" })[0]);
  fireEvent.click(within(management).getByRole("button", { name: "保存模板" }));
  await waitFor(() => expect(createTemplate).toHaveBeenCalledWith(expect.objectContaining({ kind: "cover", state: "draft", layout: expect.objectContaining({ preset: "standard" }) })));
  expect(within(management).getAllByRole("button", { name: "关闭编辑器" }).length).toBe(2);
  expect(within(management).getByRole("button", { name: "保存模板" })).toBeInTheDocument();
  expect(within(management).getAllByText("观察手册").length).toBeGreaterThan(0);
});

it("renders legacy templates that do not yet have a saved layout", async () => {
  const legacy = { ...cover, id: "legacy-cover", name: "旧版封面", layout: undefined } as unknown as typeof cover;
  render(<TemplateManagementPage loadTemplates={vi.fn().mockResolvedValue([legacy])} createTemplate={vi.fn()} updateTemplate={vi.fn()} publishTemplate={vi.fn()} removeTemplate={vi.fn()} />);

  expect(await screen.findByText("旧版封面")).toBeInTheDocument();
});
