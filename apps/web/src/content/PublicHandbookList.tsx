import { useEffect, useState } from "react";
import { apiClient, type PublicationSummary } from "../api/client.js";

export function PublicHandbookList({ onOpen, loadPublications = apiClient.publications }: { onOpen: (id: string) => void; loadPublications?: () => Promise<PublicationSummary[]> }) {
  const [items, setItems] = useState<PublicationSummary[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void loadPublications().then(setItems).catch(() => setFailed(true)); }, [loadPublications]);
  if (failed) return <p role="alert">公共手册加载失败，请稍后重试。</p>;
  if (!items.length) return <p className="public-handbook-empty">公共空间还没有发布手册。</p>;
  return <section className="public-handbook-grid" aria-label="公共观察档案">{items.map(item => <article className="public-handbook-tile" key={item.id}>
    {item.coverThumbnailUrl ? <img src={item.coverThumbnailUrl} alt={`${item.title}封面`} /> : <div className="public-handbook-cover-placeholder" aria-label={`${item.title}封面`} role="img"><span>观察手册</span><strong>{item.title}</strong></div>}
    <div className="public-handbook-copy"><div><span>公开手册</span><time>发布于 {new Date(item.publishedAt).toLocaleDateString("zh-CN")}</time></div><h2>{item.title}</h2><p>{item.introduction || "一册正在生长的观察记录。"}</p><footer><b>{item.childName}</b><span>{item.childName} · {item.cardCount} 张卡片</span><button type="button" onClick={() => onOpen(item.id)} aria-label={`阅读整本手册 ${item.title}`}>阅读整本手册 →</button></footer></div>
  </article>)}</section>;
}
