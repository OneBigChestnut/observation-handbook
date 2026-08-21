import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createObservationCard, DEFAULT_CARD_VIEW, type CardView } from "@observation-handbook/domain";
import "./styles.css";

type Card = {
  id: string;
  date: string;
  title: string;
  note: string;
  tags: string[];
  photos: string[];
};

type Handbook = {
  id: string;
  title: string;
  introduction: string;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
  cardCount: number;
  cover: string;
  status: "持续观察" | "已完成";
};

type TagSummary = { name: string; cardCount: number; handbookCount: number; lastSeen: string; color: string };
type ExportFile = { title: string; handbook: string; kind: "屏幕 PDF" | "印刷 PDF"; createdAt: string; size: string; status: "可下载" | "需要预检" };

const seedCards: Card[] = [
  { id: "1", date: "08.18", title: "银杏叶的边缘", note: "今天发现最外圈的叶子已经有一点点金黄。", tags: ["银杏", "夏末"], photos: ["photo-1502082553048-f009c37129b9", "photo-1523712999610-f77fbcfc3843"] },
  { id: "2", date: "08.16", title: "雨后的石阶", note: "水从石缝里流过，像一条很小的河。", tags: ["街道", "雨"], photos: ["photo-1511497584788-876760111969"] },
  { id: "3", date: "08.12", title: "蜗牛的下午", note: "它把触角伸得很长，背着房子走得不快。", tags: ["小动物"], photos: ["photo-1531219572328-a0171b4448a3"] },
  { id: "4", date: "08.09", title: "窗台上的影子", note: "下午四点的光，把花盆拉得很长。", tags: ["家里", "光影"], photos: ["photo-1497250681960-ef046c08a56e", "photo-1501004318641-b39e6451bec6"] },
  { id: "5", date: "08.04", title: "老街的修补", note: "蓝色门旁边多了一块新木板。", tags: ["街道"], photos: ["photo-1470770841072-f978cf4d019e"] },
  { id: "6", date: "08.01", title: "第一颗落果", note: "树下有一颗小小的果子，摸起来是凉的。", tags: ["银杏"], photos: ["photo-1545239351-1141bd82e8a6"] },
];

const handbooks: Handbook[] = [
  { id: "ginkgo", title: "银杏的一年", introduction: "从春天的新芽，到冬天静静落下的叶子。", startedAt: "2026.03.10", updatedAt: "2026.08.18", cardCount: 18, cover: "photo-1502082553048-f009c37129b9", status: "持续观察" },
  { id: "street", title: "门前的街道", introduction: "留意街角店铺、路面和季节里的细小变化。", startedAt: "2026.04.02", updatedAt: "2026.08.16", cardCount: 12, cover: "photo-1470770841072-f978cf4d019e", status: "持续观察" },
  { id: "rain", title: "雨天收集册", introduction: "雨滴、积水、伞面和雨后出现的小生物。", startedAt: "2026.05.14", completedAt: "2026.07.30", updatedAt: "2026.07.30", cardCount: 9, cover: "photo-1511497584788-876760111969", status: "已完成" },
];

const tags: TagSummary[] = [
  { name: "银杏", cardCount: 18, handbookCount: 1, lastSeen: "08.18", color: "ochre" },
  { name: "街道", cardCount: 12, handbookCount: 1, lastSeen: "08.16", color: "slate" },
  { name: "小动物", cardCount: 8, handbookCount: 2, lastSeen: "08.12", color: "forest" },
  { name: "雨", cardCount: 7, handbookCount: 1, lastSeen: "07.30", color: "blue" },
  { name: "光影", cardCount: 5, handbookCount: 0, lastSeen: "08.09", color: "rose" },
  { name: "家里", cardCount: 4, handbookCount: 0, lastSeen: "08.09", color: "olive" },
];

const exportsList: ExportFile[] = [
  { title: "银杏的一年 · 屏幕版", handbook: "银杏的一年", kind: "屏幕 PDF", createdAt: "2026.08.18", size: "12.4 MB", status: "可下载" },
  { title: "雨天收集册 · 印刷版", handbook: "雨天收集册", kind: "印刷 PDF", createdAt: "2026.07.30", size: "25.7 MB", status: "可下载" },
  { title: "门前的街道 · 印刷版", handbook: "门前的街道", kind: "印刷 PDF", createdAt: "今天", size: "—", status: "需要预检" },
];

const photoChoices = ["photo-1502082553048-f009c37129b9", "photo-1511497584788-876760111969", "photo-1531219572328-a0171b4448a3", "photo-1497250681960-ef046c08a56e"];

const viewNames: Record<CardView, string> = { month: "按月", timeline: "时间流", calendar: "月历" };
const imageUrl = (id: string, width = 480) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

function CardTile({ card }: { card: Card }) {
  return <article className="card-tile">
    <div className={`photo-layout photo-count-${card.photos.length}`}>
      {card.photos.map((photo) => <img key={photo} src={imageUrl(photo)} alt="" />)}
    </div>
    <div className="card-copy">
      <time>{card.date}</time>
      <h3>{card.title}</h3>
      <p>{card.note}</p>
      <div className="tag-row">{card.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>
    </div>
  </article>;
}

function HandbookTile({ handbook }: { handbook: Handbook }) {
  return <article className="handbook-tile">
    <img className="handbook-cover" src={imageUrl(handbook.cover, 720)} alt="" />
    <div className="handbook-overlay"></div>
    <div className="handbook-meta"><span>{handbook.status}</span><time>更新于 {handbook.updatedAt}</time></div>
    <div className="handbook-copy"><p>{handbook.startedAt}{handbook.completedAt ? ` — ${handbook.completedAt}` : " — 至今"}</p><h2>{handbook.title}</h2><div className="handbook-footer"><span>{handbook.cardCount} 张观察卡片</span><i>查看手册 →</i></div></div>
    <div className="handbook-intro"><p>{handbook.introduction}</p></div>
  </article>;
}

function TagTile({ tag }: { tag: TagSummary }) {
  return <article className={`tag-tile ${tag.color}`}>
    <div className="tag-tile-head"><span>#</span><time>最近 · {tag.lastSeen}</time></div>
    <h2>{tag.name}</h2>
    <p>将散落的记录聚拢为一个持续观察的主题。</p>
    <footer><b>{tag.cardCount}</b><span>张卡片</span><i></i><b>{tag.handbookCount}</b><span>本手册</span><em>→</em></footer>
  </article>;
}

function ExportRow({ file }: { file: ExportFile }) {
  return <article className="export-row"><div className="pdf-mark">PDF</div><div className="export-title"><h2>{file.title}</h2><p>{file.handbook} · {file.kind}</p></div><time>{file.createdAt}</time><span className={file.status === "可下载" ? "export-ready" : "export-warning"}>{file.status}</span><span className="export-size">{file.size}</span><button>{file.status === "可下载" ? "下载" : "查看预检"} →</button></article>;
}

function App() {
  const [activeNav, setActiveNav] = useState("今日记录");
  const [view, setView] = useState<CardView>(DEFAULT_CARD_VIEW);
  const [child, setChild] = useState("乐乐");
  const [cardItems, setCardItems] = useState(seedCards);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftPhotos, setDraftPhotos] = useState([photoChoices[0]]);
  const [draftTags, setDraftTags] = useState<string[]>(["银杏"]);
  const heading = useMemo(() => activeNav === "今日记录" ? "八月的观察" : activeNav, [activeNav]);
  const isRecordView = activeNav === "今日记录";
  const actionLabel = isRecordView ? "新建记录" : activeNav === "标签管理" ? "新建标签" : activeNav === "导出文件" ? "导出手册" : "新建手册";
  const togglePhoto = (photo: string) => setDraftPhotos(current => current.includes(photo) ? current.filter(item => item !== photo) : current.length < 4 ? [...current, photo] : current);
  const toggleTag = (tag: string) => setDraftTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]);
  const saveCard = () => {
    const created = createObservationCard({ childId: child, photos: draftPhotos, text: draftText.trim() });
    setCardItems(current => [{ id: String(Date.now()), date: "08.21", title: created.text.slice(0, 12) || "新的观察", note: created.text || "今天的观察。", tags: draftTags, photos: created.photos }, ...current]);
    setDraftText(""); setDraftPhotos([photoChoices[0]]); setDraftTags(["银杏"]); setComposerOpen(false);
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">O</span><span>观察手册</span></div>
      <div className="family-label">林家档案室 <span>⌄</span></div>
      <nav aria-label="主导航">
        {["今日记录", "观察手册", "标签管理", "导出文件"].map(item => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}>{item}</button>)}
      </nav>
      <div className="nav-section">
        <p>发现</p>
        <button onClick={() => setActiveNav("公共空间")}>公共空间 <span>↗</span></button>
      </div>
      <div className="sidebar-bottom">
        <button className="child-switcher" onClick={() => setChild(child === "乐乐" ? "安安" : "乐乐")}>
          <span className="avatar">{child.slice(0, 1)}</span>
          <span><b>{child}</b><small>切换小朋友</small></span><i>⌄</i>
        </button>
        <button className="account"><span className="account-avatar">林</span><span>林然<small>家庭管理员</small></span></button>
      </div>
    </aside>

    <main>
      <header className="topbar">
        <button className="mobile-menu" aria-label="打开导航">☰</button>
        <div className="crumb"><span>家庭端</span><b>/</b><strong>{activeNav}</strong></div>
        <div className="top-actions"><button className="search">⌕ <span>搜索</span></button><button className="new-card" onClick={() => isRecordView && setComposerOpen(true)}>＋ {actionLabel}</button></div>
      </header>
      <section className="page-heading">
        <div><p className="eyebrow">{child}的观察档案 · 2026</p><h1>{heading}</h1><p className="subhead">{isRecordView ? "把当下的发现，收进时间的册页。" : activeNav === "观察手册" ? "将同一主题的发现编成可以持续生长的手册。" : activeNav === "标签管理" ? "为观察命名，并把同一主题的记录聚拢在一起。" : activeNav === "导出文件" ? "每一次导出都保存为不可变的手册快照。" : "按孩子独立整理和查看内容。"}</p></div>
        <div className="summary"><b>{isRecordView ? "06" : "03"}</b><span>{isRecordView ? "本月记录" : "观察手册"}</span><em></em><b>{isRecordView ? "04" : "39"}</b><span>{isRecordView ? "观察主题" : "收录卡片"}</span></div>
      </section>
      {isRecordView && <section className="toolbar">
        <div className="month-select">2026 年 08 月 <span>⌄</span></div>
        <div className="view-switcher">{(Object.keys(viewNames) as CardView[]).map(key => <button key={key} className={view === key ? "selected" : ""} onClick={() => setView(key)}>{viewNames[key]}</button>)}</div>
        <button className="filter">筛选 <span>≡</span></button>
      </section>}
      {isRecordView && view === "month" && <section className="month-view">
        <div className="month-rule"><span>08</span><i></i><p>2026 · 八月</p></div>
        <div className="card-grid">{cardItems.map(card => <CardTile key={card.id} card={card} />)}</div>
      </section>}
      {isRecordView && view === "timeline" && <section className="timeline-view">{cardItems.map(card => <div className="timeline-row" key={card.id}><time>2026. {card.date}</time><CardTile card={card} /></div>)}</section>}
      {isRecordView && view === "calendar" && <section className="calendar-view"><div className="weekday">一</div><div className="weekday">二</div><div className="weekday">三</div><div className="weekday">四</div><div className="weekday">五</div><div className="weekday">六</div><div className="weekday">日</div>{Array.from({ length: 31 }, (_, i) => <div className="calendar-day" key={i}><b>{i + 1}</b>{cardItems.find(card => Number(card.date.slice(3)) === i + 1) && <span>有记录</span>}</div>)}</section>}
      {activeNav === "观察手册" && <section className="handbook-view"><div className="handbook-rule"><p>正在整理</p><i></i><span>按最近更新</span></div><div className="handbook-grid">{handbooks.map(handbook => <HandbookTile key={handbook.id} handbook={handbook} />)}</div></section>}
      {activeNav === "标签管理" && <section className="tag-view"><div className="tag-rule"><p>全部标签</p><i></i><span>{tags.length} 个主题</span></div><div className="tag-grid">{tags.map(tag => <TagTile key={tag.name} tag={tag} />)}</div></section>}
      {activeNav === "导出文件" && <section className="export-view"><div className="export-options"><article><span className="export-option-icon screen">▣</span><div><b>屏幕 PDF</b><p>适合电脑、手机和平板查看；不添加出血或裁切线。</p></div><button>导出屏幕版 →</button></article><article><span className="export-option-icon print">✣</span><div><b>印刷 PDF</b><p>默认 3mm 出血与裁切线；导出前检查图片分辨率、安全区和文字溢出。</p></div><button>导出印刷版 →</button></article></div><div className="export-rule"><p>导出历史</p><i></i><span>{exportsList.length} 个文件</span></div><div className="export-list">{exportsList.map(file => <ExportRow key={file.title} file={file} />)}</div></section>}
      {isComposerOpen && <div className="composer-backdrop" role="presentation" onMouseDown={() => setComposerOpen(false)}><form className="card-composer" onSubmit={(event) => { event.preventDefault(); saveCard(); }} onMouseDown={event => event.stopPropagation()}>
        <header><div><p>为 {child} 新建</p><h2>观察卡片</h2></div><button type="button" aria-label="关闭新建卡片" onClick={() => setComposerOpen(false)}>×</button></header>
        <label className="field-label">选择照片 <span>{draftPhotos.length}/4</span></label><div className="photo-picker">{photoChoices.map(photo => <button type="button" className={draftPhotos.includes(photo) ? "picked" : ""} key={photo} onClick={() => togglePhoto(photo)}><img src={imageUrl(photo, 180)} alt="" /><i>{draftPhotos.includes(photo) ? "✓" : "+"}</i></button>)}</div>
        <label className="field-label" htmlFor="observation-text">写下发现</label><textarea id="observation-text" value={draftText} onChange={event => setDraftText(event.target.value)} placeholder="今天发现了什么？" rows={4} />
        <span className="field-label">添加标签</span><div className="composer-tags">{tags.map(tag => <button type="button" className={draftTags.includes(tag.name) ? "picked" : ""} key={tag.name} onClick={() => toggleTag(tag.name)}>#{tag.name}</button>)}</div>
        <footer><button type="button" onClick={() => setComposerOpen(false)}>取消</button><button className="save-card" type="submit">保存记录</button></footer>
      </form></div>}
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
