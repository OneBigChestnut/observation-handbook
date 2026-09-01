import { useEffect, useState } from "react";
import { apiClient, type ObservationCardSummary } from "../api/client.js";
import { TemplateSelector, type PublishedTemplate } from "./TemplateSelector.js";

export interface CreateHandbookFormProps {
  childId: string;
  loadTemplates?: (kind: PublishedTemplate["kind"]) => Promise<PublishedTemplate[]>;
  loadCards?: (childId: string) => Promise<ObservationCardSummary[]>;
  createHandbook?: (childId: string, payload: { title: string; introduction: string; startedAt: string; completedAt?: string; tagIds: string[]; cardIds: string[]; coverTemplateId?: string; backTemplateId?: string; coverPhotoId?: string; backPhotoId?: string }) => Promise<{ id: string }>;
  onCreated: () => void;
}

export function CreateHandbookForm({ childId, loadTemplates = apiClient.templates, loadCards = apiClient.cards, createHandbook = apiClient.createHandbook, onCreated }: CreateHandbookFormProps) {
  const [title, setTitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [completedAt, setCompletedAt] = useState("");
  const [coverTemplateId, setCoverTemplateId] = useState("");
  const [backTemplateId, setBackTemplateId] = useState("");
  const [cards, setCards] = useState<ObservationCardSummary[]>([]);
  const [coverPhotoId, setCoverPhotoId] = useState("");
  const [backPhotoId, setBackPhotoId] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { void loadCards(childId).then(setCards).catch(() => setCards([])); }, [childId, loadCards]);
  const photos = cards.flatMap(card => card.photos.map(photo => ({ ...photo, observedAt: card.observedAt, text: card.text }))).filter((photo, index, all) => all.findIndex(item => item.id === photo.id) === index);

  return <form className="export-dialog" onSubmit={async event => {
    event.preventDefault();
    if (!title.trim() || !introduction.trim()) { setNotice("请填写手册名称和内容介绍。"); return; }
    if (!coverTemplateId || !backTemplateId) { setNotice("请选择已发布的封面和封底模板。"); return; }
    setSubmitting(true);
    setNotice("正在创建手册…");
    try {
      await createHandbook(childId, { title: title.trim(), introduction: introduction.trim(), startedAt, ...(completedAt ? { completedAt } : {}), tagIds: [], cardIds: [], coverTemplateId, backTemplateId, ...(coverPhotoId ? { coverPhotoId } : {}), ...(backPhotoId ? { backPhotoId } : {}) });
      onCreated();
    } catch {
      setNotice("创建失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }}>
    <header><div><p>新建观察手册 · A5 竖版</p><h2>手册信息</h2></div></header>
    <label className="field-label">手册名称<input aria-label="手册名称" value={title} onChange={event => setTitle(event.target.value)} placeholder="例如：银杏的一年" /></label>
    <label className="field-label">内容介绍<textarea aria-label="内容介绍" value={introduction} onChange={event => setIntroduction(event.target.value)} rows={2} placeholder="这一册想持续观察什么？" /></label>
    <label className="field-label">开始时间<input aria-label="开始时间" type="date" value={startedAt} onChange={event => setStartedAt(event.target.value)} /></label>
    <label className="field-label">完成时间（可留空）<input aria-label="完成时间（可留空）" type="date" value={completedAt} onChange={event => setCompletedAt(event.target.value)} /></label>
    <span className="field-label">出版模板</span><TemplateSelector kind="cover" loadTemplates={loadTemplates} value={coverTemplateId} onChange={setCoverTemplateId} label="封面模板" /><TemplateSelector kind="back" loadTemplates={loadTemplates} value={backTemplateId} onChange={setBackTemplateId} label="封底模板" />
    <div className="handbook-photo-choice"><span className="field-label">封面和封底照片</span>{photos.length ? <div className="handbook-photo-strip">{photos.map(photo => <article key={photo.id} className={coverPhotoId === photo.id || backPhotoId === photo.id ? "picked" : ""}><img src={photo.thumbnailUrl} alt={photo.text || "观察照片"} /><small>{photo.observedAt}</small><div><button type="button" aria-label={`选择为封面 ${photo.text}`} onClick={() => setCoverPhotoId(photo.id)}>封面</button><button type="button" aria-label={`选择为封底 ${photo.text}`} onClick={() => setBackPhotoId(photo.id)}>封底</button></div></article>)}</div> : <p className="dialog-note">当前还没有可用观察照片，可以先创建手册，之后再补选。</p>}<p className="dialog-note">封面：{coverPhotoId ? "已选择" : "暂不选择"} · 封底：{backPhotoId ? "已选择" : "暂不选择"}</p></div>
    <footer><button className="save-card" type="submit" disabled={submitting}>创建手册</button>{notice && <span role="status">{notice}</span>}</footer>
  </form>;
}
