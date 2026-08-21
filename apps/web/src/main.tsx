import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createGeneratedExport, createObservationCard, DEFAULT_CARD_VIEW, removeGeneratedExport, type CardView, type PdfExportKind } from "@observation-handbook/domain";
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
type ExportFile = { id: string; title: string; handbook: string; kind: "屏幕 PDF" | "印刷 PDF"; createdAt: string; size: string; status: "可下载" | "需要预检" };
type PublicHandbook = { title: string; introduction: string; family: string; child: string; publishedAt: string; cardCount: number; cover: string; tag: string };
type FamilyMemberSummary = { name: string; initial: string; role: "家庭管理员" | "只读成员"; joinedAt: string; color: string };
type AdminTemplate = { name: string; version: string; usage: number; status: "已发布" | "已停用"; updatedAt: string };

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

const seedExports: ExportFile[] = [
  { id: "export-ginkgo-screen", title: "银杏的一年 · 屏幕版", handbook: "银杏的一年", kind: "屏幕 PDF", createdAt: "2026.08.18", size: "12.4 MB", status: "可下载" },
  { id: "export-rain-print", title: "雨天收集册 · 印刷版", handbook: "雨天收集册", kind: "印刷 PDF", createdAt: "2026.07.30", size: "25.7 MB", status: "可下载" },
  { id: "export-street-print", title: "门前的街道 · 印刷版", handbook: "门前的街道", kind: "印刷 PDF", createdAt: "今天", size: "—", status: "需要预检" },
];

const publicHandbooks: PublicHandbook[] = [
  { title: "四季里的银杏", introduction: "从一片新芽开始，记录树叶颜色、气味和落果。", family: "林家档案室", child: "乐乐", publishedAt: "08.20", cardCount: 18, cover: "photo-1502082553048-f009c37129b9", tag: "自然观察" },
  { title: "河边的小动物", introduction: "在固定的散步路线上遇见蜗牛、白鹭和小鱼。", family: "王家观察室", child: "小满", publishedAt: "08.18", cardCount: 12, cover: "photo-1531219572328-a0171b4448a3", tag: "小动物" },
  { title: "一条街的夏天", introduction: "店铺招牌、修补中的路面和每天不同的光。", family: "陈家手册", child: "豆豆", publishedAt: "08.15", cardCount: 21, cover: "photo-1470770841072-f978cf4d019e", tag: "城市漫游" },
];

const familyMembers: FamilyMemberSummary[] = [
  { name: "林然", initial: "林", role: "家庭管理员", joinedAt: "创建人 · 2026.03.01", color: "green" },
  { name: "周宁", initial: "周", role: "只读成员", joinedAt: "加入于 2026.05.12", color: "ochre" },
  { name: "陈雪", initial: "陈", role: "只读成员", joinedAt: "加入于 2026.06.08", color: "blue" },
];

const adminTemplates: AdminTemplate[] = [
  { name: "自然观察 · 标准册", version: "v1.3", usage: 128, status: "已发布", updatedAt: "2026.08.18" },
  { name: "城市漫游 · 横向册", version: "v1.1", usage: 64, status: "已发布", updatedAt: "2026.08.12" },
  { name: "自然观察 · 初版", version: "v1.0", usage: 92, status: "已停用", updatedAt: "2026.05.03" },
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

function ExportRow({ file, onDelete, onDownload }: { file: ExportFile; onDelete: (id: string) => void; onDownload: (file: ExportFile) => void }) {
  return <article className="export-row"><div className="pdf-mark">PDF</div><div className="export-title"><h2>{file.title}</h2><p>{file.handbook} · {file.kind}</p></div><time>{file.createdAt}</time><span className={file.status === "可下载" ? "export-ready" : "export-warning"}>{file.status}</span><span className="export-size">{file.size}</span><div className="export-actions"><button onClick={() => onDownload(file)}>{file.status === "可下载" ? "下载" : "查看预检"} →</button><button className="delete-export" aria-label={`删除 ${file.title}`} onClick={() => onDelete(file.id)}>删除</button></div></article>;
}

function PublicHandbookTile({ handbook }: { handbook: PublicHandbook }) {
  return <article className="public-handbook-tile"><img src={imageUrl(handbook.cover, 720)} alt="" /><div className="public-handbook-copy"><div><span>#{handbook.tag}</span><time>发布于 {handbook.publishedAt}</time></div><h2>{handbook.title}</h2><p>{handbook.introduction}</p><footer><b>{handbook.family}</b><span>{handbook.child} · {handbook.cardCount} 张卡片</span><i>阅读 →</i></footer></div></article>;
}

function FamilyMemberRow({ member }: { member: FamilyMemberSummary }) {
  return <article className="member-row"><span className={`member-avatar ${member.color}`}>{member.initial}</span><div><h2>{member.name}</h2><p>{member.joinedAt}</p></div><span className={member.role === "家庭管理员" ? "member-admin" : "member-reader"}>{member.role}</span><button>查看权限 →</button></article>;
}

function AdminTemplateRow({ template }: { template: AdminTemplate }) {
  return <article className="admin-template-row"><div className="template-sheet"><span>{template.version}</span></div><div><h2>{template.name}</h2><p>更新于 {template.updatedAt}</p></div><span>{template.usage} 次使用</span><span className={template.status === "已发布" ? "template-live" : "template-retired"}>{template.status}</span><button aria-label={`管理 ${template.name}`}>→</button></article>;
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
  const [exportFiles, setExportFiles] = useState(seedExports);
  const [isExportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedHandbookId, setSelectedHandbookId] = useState(handbooks[0].id);
  const [selectedPdfKind, setSelectedPdfKind] = useState<PdfExportKind>("screen");
  const [exportNotice, setExportNotice] = useState("");
  const heading = useMemo(() => activeNav === "今日记录" ? "八月的观察" : activeNav, [activeNav]);
  const isRecordView = activeNav === "今日记录";
  const isPublicSpace = activeNav === "公共空间";
  const isFamilyMembers = activeNav === "家庭成员";
  const isSuperAdmin = true;
  const isAdminCenter = activeNav === "后台中心";
  const actionLabel = isRecordView ? "新建记录" : activeNav === "标签管理" ? "新建标签" : activeNav === "导出文件" ? "导出手册" : "新建手册";
  const togglePhoto = (photo: string) => setDraftPhotos(current => current.includes(photo) ? current.filter(item => item !== photo) : current.length < 4 ? [...current, photo] : current);
  const toggleTag = (tag: string) => setDraftTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]);
  const saveCard = () => {
    const created = createObservationCard({ childId: child, photos: draftPhotos, text: draftText.trim() });
    setCardItems(current => [{ id: String(Date.now()), date: "08.21", title: created.text.slice(0, 12) || "新的观察", note: created.text || "今天的观察。", tags: draftTags, photos: created.photos }, ...current]);
    setDraftText(""); setDraftPhotos([photoChoices[0]]); setDraftTags(["银杏"]); setComposerOpen(false);
  };
  const generateExport = () => {
    const handbook = handbooks.find(item => item.id === selectedHandbookId) ?? handbooks[0];
    const generated = createGeneratedExport({ id: `export-${Date.now()}`, handbookId: handbook.id, kind: selectedPdfKind });
    const kind = generated.kind === "screen" ? "屏幕 PDF" : "印刷 PDF";
    setExportFiles(current => [{ id: generated.id, title: `${handbook.title} · ${generated.kind === "screen" ? "屏幕版" : "印刷版"}`, handbook: handbook.title, kind, createdAt: "刚刚", size: generated.kind === "screen" ? "8.6 MB" : "18.2 MB", status: "可下载" }, ...current]);
    setExportNotice(`已生成「${handbook.title}」${kind}，现在可以下载。`);
    setExportDialogOpen(false);
  };
  const downloadExport = async (file: ExportFile) => {
    if (file.status !== "可下载") { setExportNotice("印刷版需要先通过预检，才能生成并下载。"); return; }
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFontSize(22); pdf.text(file.handbook, 20, 28);
    pdf.setFontSize(12); pdf.text(file.kind, 20, 38);
    pdf.setFontSize(10); pdf.text("Observation handbook export snapshot", 20, 48);
    pdf.save(`${file.title}.pdf`);
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">O</span><span>观察手册</span></div>
      <div className="family-label">林家档案室 <span>⌄</span></div>
      <nav aria-label="主导航">
        {["今日记录", "观察手册", "标签管理", "导出文件", "家庭成员"].map(item => <button key={item} className={activeNav === item ? "active" : ""} onClick={() => setActiveNav(item)}>{item}</button>)}
      </nav>
      <div className="nav-section">
        <p>发现</p>
        <button onClick={() => setActiveNav("公共空间")}>公共空间 <span>↗</span></button>
      </div>
      {isSuperAdmin && <div className="nav-section admin-nav"><p>管理</p><button className={isAdminCenter ? "active" : ""} onClick={() => setActiveNav("后台中心")}>后台中心 <span>⌘</span></button></div>}
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
        <div className="top-actions"><button className="search">⌕ <span>搜索</span></button>{!isPublicSpace && !isFamilyMembers && !isAdminCenter && <button className="new-card" onClick={() => isRecordView ? setComposerOpen(true) : activeNav === "导出文件" ? setExportDialogOpen(true) : undefined}>＋ {actionLabel}</button>}</div>
      </header>
      <section className="page-heading">
        <div><p className="eyebrow">{isAdminCenter ? "平台管理 · 超级管理员" : isPublicSpace ? "公共观察档案 · 正在持续更新" : `${child}的观察档案 · 2026`}</p><h1>{heading}</h1><p className="subhead">{isRecordView ? "把当下的发现，收进时间的册页。" : activeNav === "观察手册" ? "将同一主题的发现编成可以持续生长的手册。" : activeNav === "标签管理" ? "为观察命名，并把同一主题的记录聚拢在一起。" : activeNav === "导出文件" ? "生成后可下载或删除；屏幕版无出血，印刷版含 3mm 出血与裁切线。" : isFamilyMembers ? "一个家庭只有一位管理员，其他成人仅可查看内容。" : isAdminCenter ? "管理平台成员、固定模板版本与操作日志。" : "来自不同家庭的持续观察手册。"}</p></div>
        <div className="summary"><b>{isRecordView ? "06" : isPublicSpace ? "03" : "03"}</b><span>{isRecordView ? "本月记录" : isPublicSpace ? "新近发布" : "观察手册"}</span><em></em><b>{isRecordView ? "04" : isPublicSpace ? "51" : "39"}</b><span>{isRecordView ? "观察主题" : isPublicSpace ? "收录卡片" : "收录卡片"}</span></div>
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
      {activeNav === "导出文件" && <section className="export-view">{exportNotice && <div className="export-success"><span>✓</span>{exportNotice}<button aria-label="关闭提示" onClick={() => setExportNotice("")}>×</button></div>}<div className="export-rule"><p>已生成文件</p><i></i><span>{exportFiles.length} 个文件</span></div><div className="export-list">{exportFiles.map(file => <ExportRow key={file.id} file={file} onDelete={id => setExportFiles(current => removeGeneratedExport(current, id))} onDownload={downloadExport} />)}</div></section>}
      {isPublicSpace && <section className="public-space-view"><div className="public-rule"><p>最新发布</p><i></i><span>全部公开手册</span></div><div className="public-handbook-grid">{publicHandbooks.map(handbook => <PublicHandbookTile key={handbook.title} handbook={handbook} />)}</div></section>}
      {isFamilyMembers && <section className="members-view"><div className="members-note"><b>成员权限</b><span>管理员可管理家庭、小朋友与发布；只读成员仅能查看。</span></div><div className="members-rule"><p>家庭成员</p><i></i><span>{familyMembers.length} 位成人</span></div><div className="members-list">{familyMembers.map(member => <FamilyMemberRow key={member.name} member={member} />)}</div></section>}
      {isAdminCenter && <section className="admin-view"><div className="admin-stats"><article><span>平台家庭</span><b>128</b><p>本月新增 12</p></article><article><span>发布模板</span><b>02</b><p>共 3 个版本</p></article><article><span>今日日志</span><b>36</b><p>全部正常</p></article></div><div className="admin-rule"><p>模板版本</p><i></i><button>＋ 新建模板</button></div><div className="admin-template-list">{adminTemplates.map(template => <AdminTemplateRow key={`${template.name}-${template.version}`} template={template} />)}</div><div className="admin-log"><b>最新日志</b><span>林然发布《四季里的银杏》至公共空间 · 10:42</span><button>查看全部 →</button></div></section>}
      {isComposerOpen && <div className="composer-backdrop" role="presentation" onMouseDown={() => setComposerOpen(false)}><form className="card-composer" onSubmit={(event) => { event.preventDefault(); saveCard(); }} onMouseDown={event => event.stopPropagation()}>
        <header><div><p>为 {child} 新建</p><h2>观察卡片</h2></div><button type="button" aria-label="关闭新建卡片" onClick={() => setComposerOpen(false)}>×</button></header>
        <label className="field-label">选择照片 <span>{draftPhotos.length}/4</span></label><div className="photo-picker">{photoChoices.map(photo => <button type="button" className={draftPhotos.includes(photo) ? "picked" : ""} key={photo} onClick={() => togglePhoto(photo)}><img src={imageUrl(photo, 180)} alt="" /><i>{draftPhotos.includes(photo) ? "✓" : "+"}</i></button>)}</div>
        <label className="field-label" htmlFor="observation-text">写下发现</label><textarea id="observation-text" value={draftText} onChange={event => setDraftText(event.target.value)} placeholder="今天发现了什么？" rows={4} />
        <span className="field-label">添加标签</span><div className="composer-tags">{tags.map(tag => <button type="button" className={draftTags.includes(tag.name) ? "picked" : ""} key={tag.name} onClick={() => toggleTag(tag.name)}>#{tag.name}</button>)}</div>
        <footer><button type="button" onClick={() => setComposerOpen(false)}>取消</button><button className="save-card" type="submit">保存记录</button></footer>
      </form></div>}
      {isExportDialogOpen && <div className="composer-backdrop" role="presentation" onMouseDown={() => setExportDialogOpen(false)}><form className="export-dialog" onSubmit={(event) => { event.preventDefault(); generateExport(); }} onMouseDown={event => event.stopPropagation()}><header><div><p>生成新文件</p><h2>导出手册</h2></div><button type="button" aria-label="关闭导出手册" onClick={() => setExportDialogOpen(false)}>×</button></header><label className="field-label" htmlFor="export-handbook">选择观察手册</label><select id="export-handbook" value={selectedHandbookId} onChange={event => setSelectedHandbookId(event.target.value)}>{handbooks.map(handbook => <option value={handbook.id} key={handbook.id}>{handbook.title} · {handbook.cardCount} 张卡片</option>)}</select><span className="field-label">选择 PDF 类型</span><div className="pdf-kind-options"><label className={selectedPdfKind === "screen" ? "selected" : ""}><input type="radio" checked={selectedPdfKind === "screen"} onChange={() => setSelectedPdfKind("screen")} name="pdf-kind" /> <b>屏幕 PDF</b><span>电脑、手机、平板查看；无出血、无裁切线。</span></label><label className={selectedPdfKind === "print" ? "selected" : ""}><input type="radio" checked={selectedPdfKind === "print"} onChange={() => setSelectedPdfKind("print")} name="pdf-kind" /> <b>印刷 PDF</b><span>3mm 出血、裁切线；生成前执行印刷预检。</span></label></div><footer><button type="button" onClick={() => setExportDialogOpen(false)}>取消</button><button className="save-card" type="submit">确认生成</button></footer></form></div>}
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
