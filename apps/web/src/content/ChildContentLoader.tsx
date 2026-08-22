import { useEffect, useState } from "react";
import { type CardView } from "@observation-handbook/domain";
import { apiClient, type ObservationCardSummary } from "../api/client.js";

type ChildContentLoaderProps = {
  childId: string;
  view?: CardView;
  loadCards?: (childId: string) => Promise<ObservationCardSummary[]>;
};

export function ChildContentLoader({ childId, view = "month", loadCards = apiClient.cards }: ChildContentLoaderProps) {
  const [cards, setCards] = useState<ObservationCardSummary[] | null>(null);

  useEffect(() => {
    setCards(null);
    void loadCards(childId).then(setCards).catch(() => setCards([]));
  }, [childId, loadCards]);

  if (cards === null) return <section aria-label="正在加载观察记录">正在加载观察记录…</section>;
  if (!cards.length) return <section aria-label="暂无观察记录">这个小朋友还没有观察记录。</section>;
  if (view === "timeline") return <section className="timeline-view" aria-label="观察记录">{cards.map(card => <div className="timeline-row" key={card.id}><time>{card.observedAt}</time><CardTile card={card} /></div>)}</section>;
  if (view === "calendar") return <section className="calendar-view" aria-label="观察记录">{Array.from({ length: 31 }, (_, index) => { const day = index + 1; const dayCards = cards.filter(card => Number(card.observedAt.slice(-2)) === day); return <div className="calendar-day" key={day}><b>{day}</b>{dayCards.length ? <img src={dayCards[0].photos[0]?.thumbnailUrl} alt={dayCards[0].text || "观察照片"} /> : <span>—</span>}</div>; })}</section>;
  return <section className="card-grid" aria-label="观察记录">{cards.map(card => <CardTile key={card.id} card={card} />)}</section>;
}

function CardTile({ card }: { card: ObservationCardSummary }) {
  return <article className="card-tile"><div className={`photo-layout photo-count-${card.photos.length}`}>{card.photos.map((photo, index) => <img key={photo.id} src={photo.thumbnailUrl} alt={index === 0 ? card.text || "观察照片" : ""} />)}</div><div className="card-copy"><time>{card.observedAt}</time><p>{card.text}</p><div className="tag-row">{card.tags.map(tag => <span key={tag.id}>#{tag.name}</span>)}</div></div></article>;
}
