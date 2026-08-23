import { useEffect, useState } from "react";
import { apiClient, type ObservationCardSummary, type TagSummary } from "../api/client.js";

export interface CreateHandbookFormProps {
  childId: string;
  loadTags?: (childId: string) => Promise<TagSummary[]>;
  loadCards?: (childId: string) => Promise<ObservationCardSummary[]>;
  createHandbook?: (childId: string, payload: { title: string; introduction: string; startedAt: string; completedAt?: string; tagIds: string[]; cardIds: string[] }) => Promise<{ id: string }>;
  onCreated: () => void;
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
}

export function CreateHandbookForm({ childId, loadTags = apiClient.tags, loadCards = apiClient.cards, createHandbook = apiClient.createHandbook, onCreated }: CreateHandbookFormProps) {
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [cards, setCards] = useState<ObservationCardSummary[]>([]);
  const [title, setTitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [completedAt, setCompletedAt] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([loadTags(childId), loadCards(childId)]).then(([nextTags, nextCards]) => {
      if (!active) return;
      setTags(nextTags);
      setCards(nextCards);
    }).catch(() => {
      if (active) setNotice("无法读取当前小朋友的标签和卡片。请稍后重试。");
    });
    return () => { active = false; };
  }, [childId, loadCards, loadTags]);

  return <form className="export-dialog" onSubmit={async event => {
    event.preventDefault();
    if (!title.trim() || !introduction.trim()) { setNotice("请填写手册名称和内容介绍。"); return; }
    setSubmitting(true);
    setNotice("正在创建手册…");
    try {
      await createHandbook(childId, { title: title.trim(), introduction: introduction.trim(), startedAt, ...(completedAt ? { completedAt } : {}), tagIds, cardIds });
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
    <fieldset className="handbook-selection"><legend>关联标签</legend>{tags.map(tag => <label key={tag.id}><input type="checkbox" aria-label={tag.name} checked={tagIds.includes(tag.id)} onChange={() => setTagIds(ids => toggleId(ids, tag.id))} /> {tag.name}</label>)}</fieldset>
    <fieldset className="handbook-selection"><legend>收录卡片</legend>{cards.map(card => <label key={card.id}><input type="checkbox" aria-label={card.text} checked={cardIds.includes(card.id)} onChange={() => setCardIds(ids => toggleId(ids, card.id))} /> {card.text}</label>)}</fieldset>
    <footer><button className="save-card" type="submit" disabled={submitting}>创建手册</button>{notice && <span role="status">{notice}</span>}</footer>
  </form>;
}
