# PDF Preview Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the handbook preview display exactly the same PDF bytes that users download.

**Architecture:** The API will expose an authenticated preview URL for an existing export job. The reader will generate a PDF first, then replace its independently styled page canvas with an embedded document pointing to that job’s preview/download response. One server-side PDF renderer remains the only layout authority.

**Tech Stack:** TypeScript, Fastify, jsPDF, React, Vitest.

**Spec:** User request dated 2026-09-01: exported PDF must match the on-page preview completely.

## Global Constraints

- Preserve existing export access controls and immutable snapshots.
- Do not reset existing user data or generated export jobs.
- Screen preview must use the same `application/pdf` response as download.
- Print PDF remains available with its 3 mm bleed and crop marks.

---

### Task 1: Make the export endpoint a reusable preview source

**Files:**
- Modify: `apps/api/src/routes/exports.ts`
- Test: `apps/api/src/routes/exports.spec.ts`

**Interfaces:**
- Consumes: `GET /api/exports/:exportId/download` immutable export snapshot.
- Produces: `GET /api/exports/:exportId/preview`, returning the same PDF body and access protections without an attachment download header.

- [ ] **Step 1: Write the failing test**

```ts
const preview = await app.inject({ method: "GET", url: `/api/exports/${job.id}/preview`, headers: { cookie: admin } });
expect(preview.statusCode).toBe(200);
expect(preview.headers["content-type"]).toContain("application/pdf");
expect(preview.body).toBe(download.body);
expect(preview.headers["content-disposition"]).toBeUndefined();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/api/src/routes/exports.spec.ts`
Expected: FAIL because `GET /preview` is not registered.

- [ ] **Step 3: Write minimal implementation**

```ts
app.get("/api/exports/:exportId/preview", async (request, reply) => {
  const pdf = await renderExportPdfAfterAccessCheck(request, reply);
  return reply.type("application/pdf").send(pdf);
});
```

Extract the shared authentication, immutable-snapshot loading, media decoding, and `renderHandbookPdf` call from the download route so preview and download render from identical inputs.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/api/src/routes/exports.spec.ts`
Expected: PASS, with byte-for-byte equal preview and download bodies.

### Task 2: Show the generated PDF in the handbook reader

**Files:**
- Modify: `apps/web/src/content/HandbookReaderModal.tsx`
- Test: `apps/web/src/content/HandbookReaderModal.spec.tsx`

**Interfaces:**
- Consumes: successful `onExport(handbookId, kind)` returning `{ id: string }` and `GET /api/exports/:id/preview`.
- Produces: a preview frame with `src="/api/exports/:id/preview"`, plus the matching download link.

- [ ] **Step 1: Write the failing test**

```tsx
await user.click(screen.getByRole("button", { name: "生成文件" }));
const preview = await screen.findByTitle("PDF 页面预览");
expect(preview).toHaveAttribute("src", "/api/exports/export-1/preview");
expect(screen.getByRole("link", { name: "下载 PDF" })).toHaveAttribute("href", "/api/exports/export-1/download");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/content/HandbookReaderModal.spec.tsx`
Expected: FAIL because the reader continues rendering a separate HTML page canvas.

- [ ] **Step 3: Write minimal implementation**

```tsx
{exportId ? <iframe title="PDF 页面预览" src={`/api/exports/${exportId}/preview`} /> : <HandbookPageRenderer ... />}
```

Leave ordering controls available before export; once a PDF is generated, explicitly label the embedded document as the exact exported preview.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/content/HandbookReaderModal.spec.tsx`
Expected: PASS, including preview and download URLs for the same export ID.

### Task 3: Verify the complete behavior

**Files:**
- Verify: `apps/api/src/routes/exports.spec.ts`
- Verify: `apps/web/src/content/HandbookReaderModal.spec.tsx`

- [ ] **Step 1: Run focused regression tests**

Run: `pnpm vitest run apps/api/src/routes/exports.spec.ts apps/web/src/content/HandbookReaderModal.spec.tsx`
Expected: PASS with no failures.

- [ ] **Step 2: Run the type check**

Run: `pnpm typecheck`
Expected: exit status 0.

- [ ] **Step 3: Visually inspect the exported PDF**

Generate an export through the local application, render the returned PDF to PNG, and compare it with the embedded preview, which points to the same endpoint.
