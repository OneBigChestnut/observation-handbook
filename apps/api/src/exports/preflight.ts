export type ExportPreflightInput = { cardCount: number; hasCoverPhoto: boolean; templateRetired: boolean; imageWidth?: number; textWithinSafeArea: boolean };
export type ExportPreflightResult = { ok: boolean; issues: string[] };
export function preflightExport(input: ExportPreflightInput): ExportPreflightResult {
  const issues = [input.cardCount === 0 && "EMPTY_HANDBOOK", !input.hasCoverPhoto && "COVER_PHOTO_REQUIRED", input.templateRetired && "TEMPLATE_RETIRED", input.imageWidth !== undefined && input.imageWidth < 1500 && "IMAGE_RESOLUTION_INSUFFICIENT", !input.textWithinSafeArea && "TEXT_OUTSIDE_SAFE_AREA"].filter(Boolean) as string[];
  return { ok: issues.length === 0, issues };
}
