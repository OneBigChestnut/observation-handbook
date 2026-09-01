import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GState, jsPDF } from "jspdf";

export type PdfCard = { observedAt: string; text: string; textBlocks?: string[]; photos: { dataUrl: string }[]; layout?: { photos?: { x: number; y: number; width: number; height: number }[]; texts?: { x: number; y: number; width: number; height: number; content: string; color: string; fontSize: number }[]; lines?: { x: number; y: number; width: number; color: string; thickness?: number }[] } };

const cjkFontCandidates = [
  process.env.PDF_CJK_FONT_PATH,
  fileURLToPath(new URL("../../assets/NotoSansSC[wght].ttf", import.meta.url)),
  "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/5feac9245cca79adaf638ded7a4994b1ddb33ca0.asset/AssetData/Hei.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
].filter((path): path is string => Boolean(path));
let cjkFontData: string | undefined;

export async function renderHandbookPdf(input: { title: string; introduction: string; childName: string; startedAt?: string; completedAt?: string | null; cards: PdfCard[]; kind: "screen" | "print"; documentId?: string; coverPhoto?: { dataUrl: string }; backPhoto?: { dataUrl: string }; templates?: { id: string; kind: string; layout: PdfCard["layout"] }[] }) {
  const bleed = input.kind === "print" ? 3 : 0;
  const pageWidth = 148 + bleed * 2;
  const pageHeight = 210 + bleed * 2;
  const pdf = new jsPDF({ unit: "mm", format: [pageWidth, pageHeight], compress: true });
  registerCjkFont(pdf);
  if (input.documentId) pdf.setFileId(input.documentId.replace(/-/g, ""));
  const green: [number, number, number] = [36, 75, 59];
  const margin = 10 + bleed;

  pdf.setFillColor(232, 240, 228);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  await drawSpecialPage(pdf, { title: input.title, introduction: input.introduction, childName: input.childName, date: input.startedAt, photo: input.coverPhoto, kind: "cover" }, pageWidth, pageHeight, bleed);

  for (const [index, card] of input.cards.entries()) {
    pdf.addPage([pageWidth, pageHeight]);
    await drawCard(pdf, card, index + 1, margin, green);
  }

  pdf.addPage([pageWidth, pageHeight]);
  pdf.setFillColor(232, 239, 232);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  await drawSpecialPage(pdf, { title: "观察手册", introduction: "把看见的变化，留在时间里。", childName: input.childName, date: input.completedAt ?? input.startedAt, photo: input.backPhoto, kind: "back" }, pageWidth, pageHeight, bleed);
  if (input.kind === "print") {
    for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
      pdf.setPage(page);
      drawCropMarks(pdf, pageWidth, pageHeight);
    }
  }
  return Buffer.from(pdf.output("arraybuffer"));
}

async function drawSpecialPage(pdf: jsPDF, page: { title: string; introduction: string; childName: string; date?: string | null; photo?: { dataUrl: string }; kind: "cover" | "back" }, pageWidth: number, pageHeight: number, bleed: number) {
  if (page.photo) { try { pdf.setGState(new GState({ opacity: .22 })); pdf.addImage(page.photo.dataUrl, "JPEG", 0, 0, pageWidth, pageHeight); pdf.setGState(new GState({ opacity: 1 })); } catch { pdf.setGState(new GState({ opacity: 1 })); } }
  const x = 12 + bleed;
  await addChineseText(pdf, page.title, x, page.kind === "cover" ? 126 : 148, 124, 14, { color: "#244b3b", size: 25, weight: 700 });
  await addChineseText(pdf, page.introduction, x, page.kind === "cover" ? 145 : 166, 124, 20, { color: "#687b70", size: 13 });
  await addChineseText(pdf, page.kind === "cover" ? `记录者 · ${page.childName} · ${page.date ?? ""}` : `${page.title} · 观察手册`, x, page.kind === "cover" ? 172 : 185, 124, 10, { color: "#5d7367", size: 10 });
  await addChineseText(pdf, page.kind === "cover" ? "观察手册" : (page.date ? `完成于 ${page.date}` : "持续观察中"), x, page.kind === "cover" ? 187 : 198, 124, 9, { color: "#9a7b43", size: 9 });
}

async function drawCard(pdf: jsPDF, card: PdfCard, number: number, margin: number, green: [number, number, number]) {
  const photos = card.photos.slice(0, 4);
  if (card.layout?.photos?.length) {
    const usableWidth = 148, usableHeight = 210;
    photos.forEach((photo, index) => { const frame = card.layout!.photos![index] ?? card.layout!.photos![0]; const x = frame.x / 100 * usableWidth; const y = frame.y / 100 * usableHeight; const width = frame.width / 100 * usableWidth; const height = frame.height / 100 * usableHeight; try { pdf.addImage(photo.dataUrl, "JPEG", x, y, width, height); } catch { pdf.setFillColor(226, 235, 226); pdf.rect(x, y, width, height, "F"); } });
    card.layout.lines?.forEach(line => { pdf.setDrawColor(line.color); pdf.setLineWidth(Math.max(.2, (line.thickness ?? 1) * .35)); pdf.line(line.x / 100 * usableWidth, line.y / 100 * usableHeight, (line.x + line.width) / 100 * usableWidth, line.y / 100 * usableHeight); });
    for (const [index, textBox] of (card.layout.texts ?? []).entries()) await addChineseText(pdf, card.textBlocks?.[index] ?? (index === 0 ? card.text : textBox.content), textBox.x / 100 * usableWidth, textBox.y / 100 * usableHeight, textBox.width / 100 * usableWidth, textBox.height / 100 * usableHeight, { color: textBox.color, size: textBox.fontSize });
    await addChineseText(pdf, card.observedAt, 118, 198, 20, 8, { color: "#987a44", size: 8 });
    return;
  }
  const columns = photos.length === 1 ? 1 : 2;
  const width = (columns === 1 ? 86 : 41) / 100 * 148;
  const height = (photos.length <= 2 ? 40 : 28) / 100 * 210;
  photos.forEach((photo, index) => {
    const x = (7 + (index % columns) * ((columns === 1 ? 86 : 41) + 4)) / 100 * 148;
    const y = (7 + Math.floor(index / columns) * ((photos.length <= 2 ? 40 : 28) + 2)) / 100 * 210;
    try { pdf.addImage(photo.dataUrl, "JPEG", x, y, width, height); } catch { pdf.setFillColor(226, 235, 226); pdf.rect(x, y, width, height, "F"); }
  });
  const copyY = (photos.length > 2 ? 71 : 55) / 100 * 210;
  await addChineseText(pdf, card.text || "一次安静的观察。", 7 / 100 * 148, copyY, 86 / 100 * 148, 20 / 100 * 210, { color: "#254c3c", size: 16 });
  pdf.setTextColor(152, 122, 68);
  pdf.setFontSize(8);
  pdf.text(card.observedAt, 118, 199);
}

function drawCropMarks(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  pdf.setDrawColor(65, 65, 65); pdf.setLineWidth(.2);
  [[0, 3, 6, 3], [3, 0, 3, 6], [pageWidth - 6, pageHeight - 3, pageWidth, pageHeight - 3], [pageWidth - 3, pageHeight - 6, pageWidth - 3, pageHeight]].forEach(([x1, y1, x2, y2]) => pdf.line(x1, y1, x2, y2));
}

async function addChineseText(pdf: jsPDF, value: string, x: number, y: number, width: number, height: number, style: { color: string; size: number; weight?: number }) {
  const fontSize = style.size * .75;
  const lineHeight = fontSize * .3528 * 1.25;
  const lines = pdf.splitTextToSize(value, width) as string[];
  const visibleLines = lines.slice(0, Math.max(1, Math.floor(height / lineHeight)));
  pdf.setFont("HandbookCjk", "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(style.color);
  visibleLines.forEach((line, index) => pdf.text(line, x, y + fontSize * .3528 + index * lineHeight));
}

function registerCjkFont(pdf: jsPDF) {
  if (!cjkFontData) {
    const fontPath = cjkFontCandidates.find(existsSync);
    if (!fontPath) throw new Error("PDF_CJK_FONT_MISSING: configure PDF_CJK_FONT_PATH with a Chinese TTF font");
    cjkFontData = readFileSync(fontPath).toString("base64");
  }
  pdf.addFileToVFS("HandbookCjk.ttf", cjkFontData);
  pdf.addFont("HandbookCjk.ttf", "HandbookCjk", "normal");
}
