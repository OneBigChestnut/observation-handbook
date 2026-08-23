// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TemplateSelector } from "./TemplateSelector.js";
it("lists only the matching three-photo card template kind", async () => {
  const loadTemplates = vi.fn().mockResolvedValue([{ id: "three", name: "三图版", kind: "card_3", state: "published" }]);
  render(<TemplateSelector kind="card_3" loadTemplates={loadTemplates} />);
  expect(await screen.findByRole("option", { name: "三图版" })).toBeInTheDocument(); expect(loadTemplates).toHaveBeenCalledWith("card_3");
});
