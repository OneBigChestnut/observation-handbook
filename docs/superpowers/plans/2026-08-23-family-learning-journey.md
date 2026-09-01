# Family Learning Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current administrator-led prototype into a safe, testable journey from anonymous learning to family-led, child-owned long-term observation and printable work.

**Architecture:** Deliver the journey in independently releasable stages. The first stage establishes real family onboarding and tests the public boundary; later stages add child identities, project-based observation, template-driven publishing, and production deployment without changing historical content ownership.

**Tech Stack:** React 19, TypeScript, Fastify, Drizzle ORM, SQLite, Vitest, jsPDF, Vite.

**Spec:** User-provided “儿童观察手册的初步思路” and the 2026-08-23 end-to-end walkthrough.

## Global Constraints

- A visitor demo must be anonymous, read-only, and cannot call write, export, or download endpoints.
- A family adult reader remains read-only; a child can access only their own child archive.
- Existing family records and generated exports must remain readable after migrations.
- Templates must have one source of truth for web preview and PDF rendering.
- Production deployment must use HTTPS, persistent media storage, automated backup, and recovery verification.

---

### Stage 1: Entry and account acceptance tests — P0

- [x] Add browser/API acceptance cases for anonymous demo access, registration, family creation, family-admin login, and cross-family denial.
- [x] Add a registration endpoint that atomically creates the first account, family, administrator membership, and first child archive.
- [x] Replace the login-only view with login/registration entry states and explicit success/error states.
- [x] Replace the current demo auto-login with a distinct anonymous, read-only demonstration projection; complete publication snapshots remain Stage 4.
- [x] Run the registration and anonymous-demo acceptance flow in a browser plus `pnpm test`, `pnpm typecheck`, and `pnpm build`.

### Stage 2: Real family and child identity — P0

- [x] Add child login credentials or controlled child PIN sessions linked to one child archive.
- [x] Permit child sessions to create/edit their own cards, handbooks, and exports; retain adult-reader read-only enforcement.
- [x] Add real API-backed family member invitations, child add/delete, password reset, and family switching UI.
- [x] Add permission tests for child write/read scope, adult-reader write denial, and direct cross-child API attacks.

### Stage 3: Project-based observation learning — P1

- [ ] Add an observation-project entity: object, place, question, start/end, target cadence, focus parts, stages, and cover.
- [ ] Require cards to belong to a project and capture structured observation dimensions: part, season/stage, change, evidence, and child hypothesis.
- [ ] Build project timeline, seasonal/part comparison, missing-observation prompts, and a guided conclusion page.
- [ ] Add end-to-end tests for several records becoming one completed project handbook.

### Stage 4: Truthful publishing and printable works — P0

- [ ] Render a template layout’s photo frames, text boxes, lines, and palette in card preview, handbook covers, and PDFs.
- [ ] Freeze complete public snapshots including cards, derived media, templates, cover, back cover, correct counts, and child display privacy choices.
- [ ] Execute export preflight in the export route; test page order, A5 dimensions, 3mm bleed, four-corner crop marks, image quality, safe areas, and frozen-download durability.
- [ ] Add public reading, withdraw, report, and platform takedown acceptance tests.

### Stage 5: Production readiness — P0

- [ ] Validate Tencent hosting capability; provide a production container, reverse proxy, HTTPS configuration, environment template, health endpoint, and persistent volume/object-storage configuration.
- [ ] Add automated encrypted backup, restore verification, media/database consistency checks, structured logs, rate limiting, and monitoring hooks.
- [ ] Run desktop/mobile browser E2E, upload interruption, low-network, backup-restore, and deployment smoke tests.

## Acceptance Matrix

| Journey | Required proof |
|---|---|
| Anonymous visitor | Can read a complete demo; every write/export/download request is denied. |
| New family | Registration creates one administrator, one family, and one child archive. |
| Child creator | Child can only write their own archive; adult reader cannot write. |
| Long observation | Multiple dated cards become a project timeline, comparison, conclusion, and handbook. |
| Public work | Published snapshot is complete, private choices are respected, and withdrawal is immediate. |
| Print work | Downloaded PDF faithfully uses selected templates and passes A5/bleed/DPI checks. |
| Operations | Restore proves records, media, and exports remain usable after deployment recovery. |
