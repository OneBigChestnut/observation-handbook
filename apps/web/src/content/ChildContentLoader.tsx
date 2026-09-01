import { useEffect, useState } from "react";
import { type CardView } from "@observation-handbook/domain";
import { apiClient, type ObservationCardSummary } from "../api/client.js";

type ChildContentLoaderProps = {
  childId: string;
  view?: CardView;
  canEdit?: boolean;
  onChanged?: () => void;
  onEdit?: (card: ObservationCardSummary) => void;
  onOpen?: (card: ObservationCardSummary) => void;
  loadCards?: (childId: string) => Promise<ObservationCardSummary[]>;
  updateCard?: (cardId: string, payload: { observedAt?: string; text?: string; tagNames?: string[]; handbookIds?: string[] }) => Promise<ObservationCardSummary>;
  archiveCard?: (cardId: string) => Promise<void>;
};

export function ChildContentLoader({ childId, view = "month", canEdit = false, onChanged, onEdit, onOpen, loadCards = apiClient.cards, archiveCard = apiClient.archiveCard }: ChildContentLoaderProps) {
  const [cards, setCards] = useState<ObservationCardSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setCards(null);
    setLoadError(false);
    let active = true;
    void Promise.resolve(loadCards?.(childId) ?? []).then(items => { if (active) setCards(items); }).catch(() => { if (active) { setCards([]); setLoadError(true); } });
    return () => { active = false; };
  }, [childId, loadCards, attempt]);

  if (cards === null) return <section aria-label="正在加载观察记录">正在加载观察记录…</section>;
  if (loadError) return <section role="alert" aria-label="观察记录加载失败"><p>观察记录加载失败，请检查网络后重试。</p><button type="button" onClick={() => setAttempt(current => current + 1)}>重试加载观察记录</button></section>;
  if (!cards.length) return <section aria-label="暂无观察记录">这个小朋友还没有观察记录。</section>;
  if (view === "timeline") return <section className="timeline-view" aria-label="观察记录">{cards.map(card => <div className="timeline-row" key={card.id}><time>{card.observedAt}</time><CardTile card={card} canEdit={canEdit} onEdit={onEdit} onOpen={onOpen} onChanged={onChanged} archiveCard={archiveCard} /></div>)}</section>;
  if (view === "calendar") return <section className="calendar-view" aria-label="观察记录">{Array.from({ length: 31 }, (_, index) => { const day = index + 1; const dayCards = cards.filter(card => Number(card.observedAt.slice(-2)) === day); return <div className="calendar-day" key={day}><b>{day}</b>{dayCards.length ? <img src={dayCards[0].photos[0]?.thumbnailUrl} alt={dayCards[0].text || "观察照片"} /> : <span>—</span>}</div>; })}</section>;
  return <section className="card-grid" aria-label="观察记录">{cards.map(card => <CardTile key={card.id} card={card} canEdit={canEdit} onEdit={onEdit} onOpen={onOpen} onChanged={onChanged} archiveCard={archiveCard} />)}</section>;
}

function CardTile({ card, canEdit, onEdit, onOpen, onChanged, archiveCard }: { card: ObservationCardSummary; canEdit: boolean; onEdit?: (card: ObservationCardSummary) => void; onOpen?: (card: ObservationCardSummary) => void; onChanged?: () => void; archiveCard: (cardId: string) => Promise<void> }) {
  const layout = card.templateLayout?.photos?.length ? card.templateLayout : { photos: card.photos.map((_, index) => ({ id: String(index), x: 10, y: 10 + index * 2, width: 80, height: 56 })), texts: [{ id: "text", x: 10, y: 72, width: 80, height: 16, color: "#254c3c" as const, fontSize: 12, content: "" }] };
  const createdDate = (card.createdAt ?? card.observedAt).slice(0, 10);
  return <article className="card-tile" onClick={() => onOpen?.(card)} role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={event => { if (onOpen && (event.key === "Enter" || event.key === " ")) onOpen(card); }}><div className="card-thumbnail">{layout.photos?.map((frame, index) => card.photos[index] ? <img key={frame.id} src={card.photos[index].thumbnailUrl} alt={index === 0 ? card.text || "观察照片" : ""} style={{ left:`${frame.x}%`, top:`${frame.y}%`, width:`${frame.width}%`, height:`${frame.height}%` }} /> : null)}{layout.texts?.map((item, index) => <span key={item.id} style={{ left:`${item.x}%`, top:`${item.y}%`, width:`${item.width}%`, height:`${item.height}%`, color:item.color, fontSize:`${item.fontSize * .45}px` }}>{card.textBlocks?.[index] ?? (index === 0 ? card.text : item.content)}</span>)}</div><div className="card-copy"><div className="card-meta"><time>制作于 {createdDate}</time><div className="card-meta-line"><span className="meta-label">标签</span><div className="tag-row">{card.tags.length ? card.tags.map(tag => <span key={tag.id}>#{tag.name}</span>) : <em>未添加</em>}</div></div><div className="card-meta-line"><span className="meta-label">手册</span><div className="handbook-row">{card.handbooks?.length ? card.handbooks.map(handbook => <span key={handbook.id}>{handbook.title}</span>) : <em>尚未收录</em>}</div></div></div>{canEdit && <footer className="card-actions"><button className="card-action" aria-label="打开卡片编辑" title="打开卡片编辑" onClick={event => { event.stopPropagation(); onEdit?.(card); }}>✎</button></footer>}</div></article>;
}
