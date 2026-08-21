export const CARD_PHOTO_LIMIT = 4;

export type ObservationCard = {
  childId: string;
  photos: string[];
  text: string;
};

export function createObservationCard(input: ObservationCard): ObservationCard {
  if (input.photos.length < 1) {
    throw new Error("a card must contain at least 1 photo");
  }
  if (input.photos.length > CARD_PHOTO_LIMIT) {
    throw new Error(`a card can contain at most ${CARD_PHOTO_LIMIT} photos`);
  }
  return { ...input, photos: [...input.photos] };
}

export function validateHandbookCardChildren(childId: string, cardChildIds: string[]): void {
  if (cardChildIds.some(cardChildId => cardChildId !== childId)) {
    throw new Error("child scope violation");
  }
}

export function retireTemplateVersion(input: { usageCount: number }): { state: "retired" } {
  if (input.usageCount < 1) {
    throw new Error("only used template versions are retired");
  }
  return { state: "retired" };
}

export type FamilyRole = "family_admin" | "family_reader";
export type FamilyMember = { accountId: string; role: FamilyRole };

export type AccountRole = FamilyRole | "super_admin";

export function assertSuperAdminAccess(role: AccountRole): void {
  if (role !== "super_admin") {
    throw new Error("super administrator access is required");
  }
}

export function assignFamilyRole(members: FamilyMember[], accountId: string, role: FamilyRole): FamilyMember[] {
  const next = members.filter(member => member.accountId !== accountId);
  if (role === "family_admin" && next.some(member => member.role === "family_admin")) {
    throw new Error("a family has exactly one family administrator");
  }
  if (role === "family_reader" && !next.some(member => member.role === "family_admin")) {
    throw new Error("a family has exactly one family administrator");
  }
  return [...next, { accountId, role }];
}

export function assertChildResourceAccess(input: { selectedChildId: string; resourceChildId: string }): void {
  if (input.selectedChildId !== input.resourceChildId) {
    throw new Error("child scope violation");
  }
}

export const CARD_VIEWS = ["month", "timeline", "calendar"] as const;
export type CardView = (typeof CARD_VIEWS)[number];
export const DEFAULT_CARD_VIEW: CardView = "month";

export function isCardView(value: string): value is CardView {
  return CARD_VIEWS.includes(value as CardView);
}

export function createThumbnailUrl(assetKey: string, width: number): string {
  if (!Number.isInteger(width) || width < 1) {
    throw new Error("thumbnail width must be a positive integer");
  }

  return `/media/${assetKey}?width=${width}&fit=cover`;
}

export type ObservationHandbook = {
  childId: string;
  title: string;
  introduction: string;
  startedAt?: string;
  completedAt?: string;
  status: "ongoing" | "completed";
  visibility: "family";
};

export function createObservationHandbook(
  input: Omit<ObservationHandbook, "status" | "visibility">,
): ObservationHandbook {
  return {
    ...input,
    completedAt: input.completedAt,
    status: input.completedAt ? "completed" : "ongoing",
    visibility: "family",
  };
}

export function publishObservationHandbook(input: { role: FamilyRole }): { visibility: "public" } {
  if (input.role !== "family_admin") {
    throw new Error("only the family administrator can publish a handbook");
  }
  return { visibility: "public" };
}

export function listPublicHandbooks<T extends { visibility: "family" | "public" }>(handbooks: T[]): T[] {
  return handbooks.filter(handbook => handbook.visibility === "public");
}

export type ObservationTag = { childId: string; name: string };

export function createObservationTag(input: ObservationTag): ObservationTag {
  const name = input.name.trim();
  if (!name) throw new Error("tag name is required");
  return { childId: input.childId, name };
}

export function groupTagsByChild(tags: ObservationTag[], childId: string): ObservationTag[] {
  return tags.filter(tag => tag.childId === childId);
}

export type PrintPreflightIssue = {
  code: "low_resolution" | "safe_area" | "text_overflow";
};

export type PdfExportKind = "screen" | "print";

export function getPdfExportSpec(kind: PdfExportKind): {
  bleedMm: number;
  cropMarks: boolean;
  runsPrintPreflight: boolean;
} {
  return kind === "print"
    ? { bleedMm: 3, cropMarks: true, runsPrintPreflight: true }
    : { bleedMm: 0, cropMarks: false, runsPrintPreflight: false };
}

export function createGeneratedExport(input: {
  id: string;
  handbookId: string;
  kind: PdfExportKind;
}): { id: string; handbookId: string; kind: PdfExportKind; status: "ready" } {
  return { ...input, status: "ready" };
}

export function removeGeneratedExport<T extends { id: string }>(files: T[], id: string): T[] {
  return files.filter(file => file.id !== id);
}

export function preflightPrintExport(input: {
  photos: Array<{ widthPx: number; heightPx: number }>;
  hasSafeAreaViolation: boolean;
  hasTextOverflow: boolean;
}): PrintPreflightIssue[] {
  const issues: PrintPreflightIssue[] = [];
  if (input.photos.some(photo => Math.min(photo.widthPx, photo.heightPx) < 1_500)) {
    issues.push({ code: "low_resolution" });
  }
  if (input.hasSafeAreaViolation) issues.push({ code: "safe_area" });
  if (input.hasTextOverflow) issues.push({ code: "text_overflow" });
  return issues;
}
