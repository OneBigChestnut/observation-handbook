import { useEffect, useState } from "react";
import { apiClient, type HandbookSummary, type TagSummary } from "../api/client.js";

export function ChildTagList({ childId, loadTags = apiClient.tags }: { childId: string; loadTags?: (childId: string) => Promise<TagSummary[]> }) {
  const tags = useChildCollection(childId, loadTags);
  if (tags === null) return <section aria-label="正在加载标签">正在加载标签…</section>;
  if (!tags.length) return <section aria-label="暂无标签">这个小朋友还没有标签。</section>;
  return <section className="tag-grid" aria-label="标签主题">{tags.map(tag => <article key={tag.id} className={`tag-tile ${tag.color}`}><div className="tag-tile-head"><span>#</span><time>{tag.cardCount} 张卡片</time></div><h2>{tag.name}</h2><p>将同一主题的观察聚拢起来。</p></article>)}</section>;
}

export function ChildHandbookList({ childId, canEdit = false, onChanged, loadHandbooks = apiClient.handbooks, updateHandbook = apiClient.updateHandbook }: { childId: string; canEdit?: boolean; onChanged?: () => void; loadHandbooks?: (childId: string) => Promise<HandbookSummary[]>; updateHandbook?: (handbookId: string, payload: Partial<{ completedAt: string; cardIds: string[] }>) => Promise<HandbookSummary> }) {
  const handbooks = useChildCollection(childId, loadHandbooks);
  if (handbooks === null) return <section aria-label="正在加载观察手册">正在加载观察手册…</section>;
  if (!handbooks.length) return <section aria-label="暂无观察手册">这个小朋友还没有观察手册。</section>;
  return <section className="handbook-list-api" aria-label="观察手册">{handbooks.map(handbook => <article key={handbook.id} className="members-note"><b>{handbook.title}</b><span>{handbook.introduction}</span><small>{handbook.startedAt}{handbook.completedAt ? ` — ${handbook.completedAt}` : " — 至今"} · {handbook.cardCount} 张卡片 · {handbook.tagCount} 个主题</small>{canEdit && <footer><button onClick={async () => { await updateHandbook(handbook.id, { completedAt: new Date().toISOString().slice(0, 10) }); onChanged?.(); }} disabled={handbook.status === "completed"}>完成观察</button><button onClick={async () => { await updateHandbook(handbook.id, { cardIds: [...handbook.cardIds].reverse() }); onChanged?.(); }} disabled={handbook.cardIds.length < 2}>反转卡片顺序</button></footer>}</article>)}</section>;
}

function useChildCollection<T>(childId: string, load: (childId: string) => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => { setItems(null); void load(childId).then(setItems).catch(() => setItems([])); }, [childId, load]);
  return items;
}
