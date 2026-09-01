import { useMemo, useState } from "react";
import type { HandbookSummary, ObservationCardSummary, TemplateLayout } from "../api/client.js";

type Page =
  | { kind: "cover"; id: "cover" }
  | { kind: "card"; id: string; card: ObservationCardSummary }
  | { kind: "back"; id: "back" };

export type HandbookReaderModalProps = {
  handbook: HandbookSummary;
  cards: ObservationCardSummary[];
  canEdit?: boolean;
  readOnly?: boolean;
  childName?: string;
  onClose: () => void;
  onSaveOrder: (cardIds: string[]) => void | Promise<void>;
  onExport?: (handbookId: string, kind: "screen" | "print") => Promise<{ id: string }>;
};

export function HandbookReaderModal({ handbook, cards, canEdit = false, readOnly = false, childName = "小朋友", onClose, onSaveOrder, onExport }: HandbookReaderModalProps) {
  const cardsById = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards]);
  const initialCards = useMemo(() => handbook.cardIds.map(id => cardsById.get(id)).filter((card): card is ObservationCardSummary => Boolean(card)), [cardsById, handbook.cardIds]);
  const [orderedCards, setOrderedCards] = useState(initialCards);
  const [selectedPage, setSelectedPage] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportKind, setExportKind] = useState<"screen" | "print">("screen");
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [exportId, setExportId] = useState<string | null>(null);
  const pages: Page[] = [{ kind: "cover", id: "cover" }, ...orderedCards.map(card => ({ kind: "card" as const, id: card.id, card })), { kind: "back", id: "back" }];
  const page = pages[selectedPage] ?? pages[0];
  const editable = canEdit && !readOnly;

  const moveCard = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= orderedCards.length) return;
    setOrderedCards(current => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setSelectedPage(current => Math.max(1, Math.min(current + delta, pages.length - 2)));
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      await onSaveOrder(orderedCards.map(card => card.id));
      setReordering(false);
    } finally {
      setSaving(false);
    }
  };

  const generateExport = async () => {
    if (!onExport) return;
    setExporting(true);
    setExportNotice("正在生成 PDF…");
    setExportId(null);
    try {
      const generated = await onExport(handbook.id, exportKind);
      setExportId(generated.id);
      setExportNotice("已生成 PDF，可以下载。");
      setExportOpen(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setExportNotice(code === "AUTH_REQUIRED" ? "登录已失效，请重新登录后再导出。" : code === "CHILD_EDIT_REQUIRED" ? "当前账号没有导出权限。" : code === "EXPORT_PREFLIGHT_FAILED" ? "手册还未满足导出条件，请检查封面、照片和卡片内容。" : code === "Failed to fetch" ? "无法连接服务，请确认服务已启动后重试。" : "生成失败，请稍后重试。");
    } finally {
      setExporting(false);
    }
  };

  return <div className="handbook-reader-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="handbook-reader-modal" role="dialog" aria-modal="true" aria-label={handbook.title} onMouseDown={event => { event.stopPropagation(); if (exportOpen) { const target = event.target as HTMLElement; if (!target.closest(".handbook-export-popover") && !target.closest(".handbook-export-trigger")) setExportOpen(false); } }}>
      <header className="handbook-reader-header"><div><p>正在阅读观察手册</p><h2>{handbook.title}</h2><span>{pages.length} 个页面 · {orderedCards.length} 张观察卡片</span></div><div className="handbook-reader-actions">{editable && onExport && <button type="button" className="handbook-export-trigger" onClick={() => { setExportOpen(current => !current); setExportNotice(""); }}>导出 PDF</button>}{editable && (reordering ? <button type="button" className="finish-reorder" onClick={() => void saveOrder()} disabled={saving}>{saving ? "保存中…" : "完成排序"}</button> : <button type="button" onClick={() => setReordering(true)}>调整顺序</button>)}<button type="button" aria-label="关闭手册阅读" onClick={onClose}>×</button>{exportOpen && onExport && <section className="handbook-export-popover" role="dialog" aria-label="导出观察手册" onMouseDown={event => event.stopPropagation()}><strong>导出观察手册</strong><label><input type="radio" name="export-kind" checked={exportKind === "screen"} onChange={() => setExportKind("screen")} /> 屏幕 PDF</label><label><input type="radio" name="export-kind" checked={exportKind === "print"} onChange={() => setExportKind("print")} /> 印刷 PDF</label><div><button type="button" onClick={() => setExportOpen(false)} disabled={exporting}>取消</button><button type="button" className="confirm-layout" onClick={() => void generateExport()} disabled={exporting}>{exporting ? "生成中…" : "生成文件"}</button></div></section>}</div></header>
      {exportNotice && <div className="handbook-export-feedback" role="status"><span>{exportNotice}</span>{exportId && <a href={`/api/exports/${exportId}/download`} download>下载 PDF</a>}</div>}
      <div className="handbook-reader-body">
        <aside className="handbook-page-rail" aria-label="手册页面缩略图">
          {pages.map((item, index) => <div key={item.id} className={`handbook-page-thumb${selectedPage === index ? " selected" : ""}`}>
            <button type="button" className="handbook-page-thumb-select" onClick={() => setSelectedPage(index)} aria-label={item.kind === "cover" ? "封面" : item.kind === "back" ? "封底" : `第 ${orderedCards.findIndex(card => card.id === item.id) + 1} 张卡片`}><HandbookPageRenderer page={item} handbook={handbook} mode="thumbnail" photoUrl={specialPhotoUrl(item, handbook, orderedCards)} childName={childName} /><span>{item.kind === "cover" ? "封面" : item.kind === "back" ? "封底" : `卡片 ${orderedCards.findIndex(card => card.id === item.id) + 1}`}</span></button>
            {reordering && item.kind === "card" && <small className="handbook-thumb-reorder"><i>{orderedCards.findIndex(card => card.id === item.id) > 0 && <button type="button" aria-label={`第 ${orderedCards.findIndex(card => card.id === item.id) + 1} 张卡片上移`} onClick={() => moveCard(orderedCards.findIndex(card => card.id === item.id), -1)}>↑</button>}</i><i>{orderedCards.findIndex(card => card.id === item.id) < orderedCards.length - 1 && <button type="button" aria-label={`第 ${orderedCards.findIndex(card => card.id === item.id) + 1} 张卡片下移`} onClick={() => moveCard(orderedCards.findIndex(card => card.id === item.id), 1)}>↓</button>}</i></small>}
          </div>)}
        </aside>
        <main className="handbook-page-stage"><div className="handbook-page-large"><HandbookPageRenderer page={page} handbook={handbook} mode="large" photoUrl={specialPhotoUrl(page, handbook, orderedCards)} childName={childName} /></div><div className="handbook-page-caption"><span>{selectedPage + 1} / {pages.length}</span><p>{page.kind === "cover" ? "封面" : page.kind === "back" ? "封底" : page.card.text}</p><div><button type="button" onClick={() => setSelectedPage(current => Math.max(0, current - 1))} disabled={selectedPage === 0}>上一页</button><button type="button" onClick={() => setSelectedPage(current => Math.min(pages.length - 1, current + 1))} disabled={selectedPage === pages.length - 1}>下一页</button>{reordering && <button className="save-card" type="button" onClick={() => void saveOrder()} disabled={saving}>{saving ? "保存中…" : "保存顺序"}</button>}</div></div></main>
      </div>
    </section>
  </div>;
}

function HandbookPageRenderer({ page, handbook, mode, photoUrl, childName }: { page: Page; handbook: HandbookSummary; mode: "thumbnail" | "large"; photoUrl?: string; childName: string }) {
  if (page.kind === "card") return <CardPage card={page.card} mode={mode} />;
  return <section className={`handbook-special-page handbook-${page.kind}`}>{photoUrl && <div className="handbook-special-photo" style={{ backgroundImage: `url(${photoUrl})` }} />}<div className="handbook-special-rule"></div><strong>{page.kind === "cover" ? handbook.title : "观察手册"}</strong><h3>{page.kind === "cover" ? handbook.introduction : "把看见的变化，留在时间里。"}</h3><p>{page.kind === "cover" ? `记录者 · ${childName} · ${handbook.startedAt}` : `${handbook.title} · ${handbook.cardIds.length} 张观察卡片`}</p><span>{page.kind === "cover" ? "观察手册" : handbook.completedAt ? `完成于 ${handbook.completedAt}` : "持续观察中"}</span></section>;
}

function specialPhotoUrl(page: Page, handbook: HandbookSummary, cards: ObservationCardSummary[]) {
  if (page.kind === "card") return undefined;
  const photoId = page.kind === "cover" ? handbook.coverPhotoId : handbook.backPhotoId;
  return photoId ? cards.flatMap(card => card.photos).find(photo => photo.id === photoId)?.thumbnailUrl : undefined;
}

function CardPage({ card, mode }: { card: ObservationCardSummary; mode: "thumbnail" | "large" }) {
  const layout = card.templateLayout?.photos?.length ? card.templateLayout : fallbackLayout(card.photos.length);
  return <section className={`handbook-card-page handbook-card-${mode}`}><div className="handbook-card-canvas">{(layout.photos ?? []).map((frame, index) => card.photos[index] && <img key={frame.id} src={card.photos[index].thumbnailUrl} alt={index === 0 ? card.text : ""} style={boxStyle(frame)} />)}{(layout.lines ?? []).map(line => <i key={line.id} style={{ left: `${line.x}%`, top: `${line.y}%`, width: `${line.width}%`, height: `${Math.max(1, line.thickness ?? 1)}px`, background: line.color }} />)}{(layout.texts ?? []).map((text, index) => <span key={text.id} style={{ ...boxStyle(text), color: text.color, fontSize: `${mode === "large" ? text.fontSize : Math.max(5, text.fontSize * .4)}px` }}>{card.textBlocks?.[index] ?? (index === 0 ? card.text : text.content)}</span>)}<time>{card.observedAt}</time></div></section>;
}

function boxStyle(box: { x: number; y: number; width: number; height: number }) { return { left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` }; }
function fallbackLayout(photoCount: number): TemplateLayout {
  const count = Math.max(1, photoCount);
  const columns = count === 1 ? 1 : 2;
  const width = columns === 1 ? 86 : 41;
  const height = count <= 2 ? 40 : 28;
  return {
    preset: "standard", safeMarginMm: 10, textAlign: "left",
    photos: Array.from({ length: count }, (_, index) => ({ id: `photo-${index}`, x: 7 + (index % columns) * (width + 4), y: 7 + Math.floor(index / columns) * (height + 2), width, height })),
    texts: [{ id: "text", x: 7, y: count > 2 ? 71 : 55, width: 86, height: 20, color: "#254c3c", fontSize: 16, content: "" }],
  };
}
