import { useEffect, useState } from "react";
import { type CardView } from "@observation-handbook/domain";
import { ApiError, apiClient, type ObservationCardSummary } from "../api/client.js";

type ChildContentLoaderProps = {
  childId: string;
  view?: CardView;
  canEdit?: boolean;
  onChanged?: () => void;
  loadCards?: (childId: string) => Promise<ObservationCardSummary[]>;
  updateCard?: (cardId: string, payload: { observedAt?: string; text?: string }) => Promise<ObservationCardSummary>;
  archiveCard?: (cardId: string) => Promise<void>;
};

export function ChildContentLoader({ childId, view = "month", canEdit = false, onChanged, loadCards = apiClient.cards, updateCard = apiClient.updateCard, archiveCard = apiClient.archiveCard }: ChildContentLoaderProps) {
  const [cards, setCards] = useState<ObservationCardSummary[] | null>(null);

  useEffect(() => {
    setCards(null);
    void loadCards(childId).then(setCards).catch(() => setCards([]));
  }, [childId, loadCards]);

  if (cards === null) return <section aria-label="正在加载观察记录">正在加载观察记录…</section>;
  if (!cards.length) return <section aria-label="暂无观察记录">这个小朋友还没有观察记录。</section>;
  if (view === "timeline") return <section className="timeline-view" aria-label="观察记录">{cards.map(card => <div className="timeline-row" key={card.id}><time>{card.observedAt}</time><CardTile card={card} canEdit={canEdit} onChanged={onChanged} updateCard={updateCard} archiveCard={archiveCard} /></div>)}</section>;
  if (view === "calendar") return <section className="calendar-view" aria-label="观察记录">{Array.from({ length: 31 }, (_, index) => { const day = index + 1; const dayCards = cards.filter(card => Number(card.observedAt.slice(-2)) === day); return <div className="calendar-day" key={day}><b>{day}</b>{dayCards.length ? <img src={dayCards[0].photos[0]?.thumbnailUrl} alt={dayCards[0].text || "观察照片"} /> : <span>—</span>}</div>; })}</section>;
  return <section className="card-grid" aria-label="观察记录">{cards.map(card => <CardTile key={card.id} card={card} canEdit={canEdit} onChanged={onChanged} updateCard={updateCard} archiveCard={archiveCard} />)}</section>;
}

function CardTile({ card, canEdit, onChanged, updateCard, archiveCard }: { card: ObservationCardSummary; canEdit: boolean; onChanged?: () => void; updateCard: (cardId: string, payload: { observedAt?: string; text?: string }) => Promise<ObservationCardSummary>; archiveCard: (cardId: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    await updateCard(card.id, { text });
    setEditing(false);
    setMessage("已保存修改。");
    onChanged?.();
  };
  const archive = async () => {
    try {
      await archiveCard(card.id);
      onChanged?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === "CARD_REFERENCED") {
        const references = error.details.affectedHandbookIds;
        const count = Array.isArray(references) ? references.length : 0;
        const handbookIds = Array.isArray(references) ? references.join("、") : "";
        setMessage(`这张卡片已被 ${count} 本手册收录${handbookIds ? `（${handbookIds}）` : ""}，不能归档。请先在手册中移除它。`);
        return;
      }
      setMessage("归档失败，请稍后重试。");
    }
  };

  return <article className="card-tile"><div className={`photo-layout photo-count-${card.photos.length}`}>{card.photos.map((photo, index) => <img key={photo.id} src={photo.thumbnailUrl} alt={index === 0 ? card.text || "观察照片" : ""} />)}</div><div className="card-copy"><time>{card.observedAt}</time>{editing ? <><label>编辑观察文字<textarea aria-label="编辑观察文字" value={text} onChange={event => setText(event.target.value)} /></label><button onClick={() => void save()}>保存</button><button onClick={() => { setEditing(false); setText(card.text); }}>取消</button></> : <p>{card.text}</p>}<div className="tag-row">{card.tags.map(tag => <span key={tag.id}>#{tag.name}</span>)}</div>{message && <p role="status">{message}</p>}{canEdit && <footer><button onClick={() => setEditing(true)}>编辑</button><button onClick={() => void archive()}>归档</button></footer>}</div></article>;
}
