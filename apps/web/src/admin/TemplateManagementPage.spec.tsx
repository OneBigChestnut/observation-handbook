// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TemplateManagementPage } from "./TemplateManagementPage.js";
it("presents fixed A5 portrait templates and can retire a version", async () => {
  const retireTemplate = vi.fn().mockResolvedValue(undefined); render(<TemplateManagementPage loadTemplates={vi.fn().mockResolvedValue([{ id: "cover", name: "自然封面", kind: "cover", state: "published", paperSize: "A5", orientation: "portrait" }])} retireTemplate={retireTemplate} />);
  expect(await screen.findByText(/A5 · 竖版/)).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "停用" })); expect(retireTemplate).toHaveBeenCalledWith("cover");
});
