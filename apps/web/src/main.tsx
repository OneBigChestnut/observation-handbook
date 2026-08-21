import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_CARD_VIEW, type CardView } from "@observation-handbook/domain";
import "./styles.css";

type Card = {
  id: string;
  date: string;
  title: string;
  note: string;
  tags: string[];
  photos: string[];
};

const cards: Card[] = [
  { id: "1", date: "08.18", title: "银杏叶的边缘", note: "今天发现最外圈的叶子已经有一点点金黄。", tags: ["银杏", "夏末"], photos: ["photo-1502082553048-f009c37129b9", "photo-1523712999610-f77fbcfc3843"] },
  { id: "2", date: "08.16", title: "雨后的石阶", note: "水从石缝里流过，像一条很小的河。", tags: ["街道", "雨"], photos: ["photo-1511497584788-876760111969"] },
  { id: "3", date: "08.12", title: "蜗牛的下午", note: "它把触角伸得很长，背着房子走得不快。", tags: ["小动物"], photos: ["photo-1531219572328-a0171b4448a3"] },
  { id: "4", date: "08.09", title: "窗台上的影子", note: "下午四点的光，把花盆拉得很长。", tags: ["家里", "光影"], photos: ["photo-1497250681960-ef046c08a56e", "photo-1501004318641-b39e6451bec6"] },
  { id: "5", date: "08.04", title: "老街的修补", note: "蓝色门旁边多了一块新木板。", tags: ["街道"], photos: ["photo-1470770841072-f978cf4d019e"] },
  { id: "6", date: "08.01", title: "第一颗落果", note: "树下有一颗小小的果子，摸起来是凉的。", tags: ["银杏"], photos: ["photo-1545239351-1141bd82e8a6"] },
];

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

function App() {
  const [activeNav, setActiveNav] = useState("今日记录");
  const [view, setView] = useState<CardView>(DEFAULT_CARD_VIEW);
  const [child, setChild] = useState("乐乐");
  const heading = useMemo(() => activeNav === "今日记录" ? "八月的观察" : activeNav, [activeNav]);

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
        <div className="top-actions"><button className="search">⌕ <span>搜索</span></button><button className="new-card">＋ 新建记录</button></div>
      </header>
      <section className="page-heading">
        <div><p className="eyebrow">{child}的观察档案 · 2026</p><h1>{heading}</h1><p className="subhead">{activeNav === "今日记录" ? "把当下的发现，收进时间的册页。" : "按孩子独立整理和查看内容。"}</p></div>
        <div className="summary"><b>06</b><span>本月记录</span><em></em><b>04</b><span>观察主题</span></div>
      </section>
      <section className="toolbar">
        <div className="month-select">2026 年 08 月 <span>⌄</span></div>
        <div className="view-switcher">{(Object.keys(viewNames) as CardView[]).map(key => <button key={key} className={view === key ? "selected" : ""} onClick={() => setView(key)}>{viewNames[key]}</button>)}</div>
        <button className="filter">筛选 <span>≡</span></button>
      </section>
      {view === "month" && <section className="month-view">
        <div className="month-rule"><span>08</span><i></i><p>2026 · 八月</p></div>
        <div className="card-grid">{cards.map(card => <CardTile key={card.id} card={card} />)}</div>
      </section>}
      {view === "timeline" && <section className="timeline-view">{cards.map(card => <div className="timeline-row" key={card.id}><time>2026. {card.date}</time><CardTile card={card} /></div>)}</section>}
      {view === "calendar" && <section className="calendar-view"><div className="weekday">一</div><div className="weekday">二</div><div className="weekday">三</div><div className="weekday">四</div><div className="weekday">五</div><div className="weekday">六</div><div className="weekday">日</div>{Array.from({ length: 31 }, (_, i) => <div className="calendar-day" key={i}><b>{i + 1}</b>{cards.find(card => Number(card.date.slice(3)) === i + 1) && <span>有记录</span>}</div>)}</section>}
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
