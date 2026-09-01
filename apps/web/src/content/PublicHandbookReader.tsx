import { useEffect, useState } from "react";
import { apiClient, type PublicationSummary } from "../api/client.js";

type Page = { title: string; text: string; kind: "cover" | "card" | "back"; date?: string; photoUrl?: string };

export function PublicHandbookReader({ id, onClose, loadPublication = apiClient.publication }: { id: string; onClose: () => void; loadPublication?: (id: string) => Promise<PublicationSummary> }) {
  const [item, setItem] = useState<PublicationSummary | null>(null);
  const [selectedPage, setSelectedPage] = useState(0);
  useEffect(() => { setItem(null); setSelectedPage(0); void loadPublication(id).then(setItem); }, [id, loadPublication]);
  const pages: Page[] = item ? [{ title: "封面", text: item.introduction, kind: "cover", photoUrl: item.coverThumbnailUrl }, ...(item.cards ?? []).map((card, index) => ({ title: `观察卡 ${index + 1}`, text: card.text, kind: "card" as const, date: card.observedAt, photoUrl: card.photos?.[0]?.thumbnailUrl })), { title: "封底", text: `${item.title} · ${item.cardCount} 张观察卡片`, kind: "back" }] : [];
  const page = pages[selectedPage];

  return <div className="handbook-reader-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="handbook-reader-modal" role="dialog" aria-modal="true" aria-label={item ? `${item.title}阅读` : "正在打开手册"} onMouseDown={event => event.stopPropagation()}>
      {!item ? <p className="public-reader-loading">正在打开手册…</p> : <>
        <header className="handbook-reader-header"><div><p>公共观察手册</p><h2>{item.title}</h2><span>{pages.length} 个页面 · {item.childName} · {item.cardCount} 张观察卡片</span></div><div className="handbook-reader-actions"><button type="button" aria-label="关闭公共手册阅读" onClick={onClose}>×</button></div></header>
        <div className="handbook-reader-body"><aside className="handbook-page-rail" aria-label="手册页面缩略图">{pages.map((entry, index) => <div className={`handbook-page-thumb${selectedPage === index ? " selected" : ""}`} key={`${entry.title}-${index}`}><button type="button" className="handbook-page-thumb-select" aria-label={entry.title} onClick={() => setSelectedPage(index)}><PublicPage page={entry} title={item.title} mode="thumbnail" /><span>{entry.title}</span></button></div>)}</aside>
          <main className="handbook-page-stage"><div className="handbook-page-large"><PublicPage page={page} title={item.title} mode="large" /></div><div className="handbook-page-caption"><span>{selectedPage + 1} / {pages.length}</span><p>{page?.kind === "cover" ? "封面" : page?.kind === "back" ? "封底" : page?.text}</p><div><button type="button" onClick={() => setSelectedPage(value => Math.max(0, value - 1))} disabled={selectedPage === 0}>上一页</button><button type="button" onClick={() => setSelectedPage(value => Math.min(pages.length - 1, value + 1))} disabled={selectedPage === pages.length - 1}>下一页</button></div></div></main>
        </div>
      </>}
    </section>
  </div>;
}

function PublicPage({ page, title, mode }: { page?: Page; title: string; mode: "thumbnail" | "large" }) {
  if (!page) return null;
  if (page.kind === "cover" || page.kind === "back") return <section className={`handbook-special-page handbook-${page.kind}`}><div className="handbook-special-photo" style={page.photoUrl ? { backgroundImage: `url(${page.photoUrl})` } : undefined} /><div className="handbook-special-rule"></div><strong>{page.kind === "cover" ? title : "观察手册"}</strong><h3>{page.text}</h3><p>{page.kind === "cover" ? "公共阅读 · 只读查看" : `${title} · 留住观察的时间`}</p><span>{page.kind === "cover" ? "观察手册" : "封底"}</span></section>;
  return <section className={`handbook-card-page public-card-page public-card-${mode}`}><div>{page.photoUrl && <img src={page.photoUrl} alt={mode === "large" ? `${page.title}照片` : ""} />}<i></i><p>{page.text}</p><time>{page.date}</time></div></section>;
}
