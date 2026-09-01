import { useEffect, useState } from "react";
import { ApiError, apiClient, type HandbookSummary, type ObservationCardSummary, type TagSummary } from "../api/client.js";
import { HandbookReaderModal } from "./HandbookReaderModal.js";

export function ChildTagList({ childId, canEdit = false, onChanged, loadTags = apiClient.tags, updateTag = apiClient.updateTag, removeTag = apiClient.removeTag }: { childId: string; canEdit?: boolean; onChanged?: () => void; loadTags?: (childId: string) => Promise<TagSummary[]>; updateTag?: (childId: string, tagId: string, payload: { name?: string; color?: string }) => Promise<TagSummary>; removeTag?: (childId: string, tagId: string) => Promise<void> }) {
  const tags = useChildCollection(childId, loadTags);
  const [editingTag, setEditingTag] = useState<TagSummary | null>(null);
  const [name, setName] = useState(""); const [color, setColor] = useState("olive"); const [notice, setNotice] = useState("");
  function openEditor(tag: TagSummary) { setEditingTag(tag); setName(tag.name); setColor(tag.color); setNotice(""); }
  async function saveTag() {
    if (!editingTag || !name.trim()) { setNotice("标签名称不能为空。"); return; }
    try { await updateTag(childId, editingTag.id, { name: name.trim(), color }); setEditingTag(null); tags.retry(); onChanged?.(); }
    catch { setNotice("保存标签失败，请检查名称是否重复。"); }
  }
  async function deleteTag() {
    if (!editingTag) return;
    try { await removeTag(childId, editingTag.id); setEditingTag(null); tags.retry(); onChanged?.(); }
    catch { setNotice("这个标签已经被卡片使用，不能删除。"); }
  }
  if (tags.loading) return <section aria-label="正在加载标签">正在加载标签…</section>;
  if (tags.error) return <section role="alert" aria-label="标签加载失败"><p>标签加载失败，请检查网络后重试。</p><button type="button" onClick={tags.retry}>重试加载标签</button></section>;
  if (!tags.items.length) return <section aria-label="暂无标签">这个小朋友还没有标签。</section>;
  return <><section className="tag-grid" aria-label="标签主题">{tags.items.map(tag => <article key={tag.id} className={`tag-tile ${tag.color}`}><div className="tag-tile-head"><span>#</span><time>{tag.cardCount} 张卡片</time></div><h2>{tag.name}</h2><p>将同一主题的观察聚拢起来。</p>{canEdit && <button type="button" aria-label={`编辑标签 ${tag.name}`} onClick={() => openEditor(tag)}>编辑</button>}</article>)}</section>{editingTag && <div className="layout-picker-backdrop" role="presentation" onMouseDown={() => setEditingTag(null)}><section className="card-layout-dialog tag-create-dialog" role="dialog" aria-modal="true" aria-label="编辑标签" onMouseDown={event => event.stopPropagation()}><div className="card-layout-dialog-bar"><h3>编辑标签</h3><button type="button" aria-label="关闭编辑标签" onClick={() => setEditingTag(null)}>×</button></div><label>标签名称<input aria-label="编辑标签名称" value={name} onChange={event => setName(event.target.value)} /></label><fieldset className="tag-color-picker"><legend>标签颜色</legend>{[["olive", "苔藓绿"], ["forest", "森林绿"], ["ochre", "赭石"], ["terracotta", "陶土"]].map(([value, label]) => <button key={value} type="button" className={color === value ? "selected" : ""} onClick={() => setColor(value)}>{label}</button>)}</fieldset><p>{editingTag.cardCount ? `已有 ${editingTag.cardCount} 张卡片使用，不能删除。` : "没有卡片使用这枚标签，可以删除。"}</p>{notice && <p role="alert">{notice}</p>}<div className="card-layout-dialog-footer">{editingTag.cardCount === 0 && <button type="button" aria-label={`删除标签 ${editingTag.name}`} onClick={() => void deleteTag()}>删除标签</button>}<button type="button" className="confirm-layout" onClick={() => void saveTag()}>保存标签</button></div></section></div>}</>;
}

export function ChildHandbookList({ childId, childName = "小朋友", canEdit = false, canPublish = canEdit, onChanged, loadHandbooks = apiClient.handbooks, loadCards = apiClient.cards, updateHandbook = apiClient.updateHandbook, publishHandbook = apiClient.publishHandbook, withdrawPublication = apiClient.withdrawPublication }: { childId: string; childName?: string; canEdit?: boolean; canPublish?: boolean; onChanged?: () => void; loadHandbooks?: (childId: string) => Promise<HandbookSummary[]>; loadCards?: (childId: string) => Promise<ObservationCardSummary[]>; updateHandbook?: (handbookId: string, payload: Partial<{ completedAt: string; cardIds: string[] }>) => Promise<HandbookSummary>; publishHandbook?: (handbookId: string) => Promise<unknown>; withdrawPublication?: (publicationId: string) => Promise<void> }) {
  const handbooks = useChildCollection(childId, loadHandbooks);
  const cards = useChildCollection(childId, loadCards);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState("");
  if (handbooks.loading || cards.loading) return <section aria-label="正在加载观察手册">正在加载观察手册…</section>;
  if (handbooks.error) return <section role="alert" aria-label="观察手册加载失败"><p>观察手册加载失败，请检查网络后重试。</p><button type="button" onClick={handbooks.retry}>重试加载观察手册</button></section>;
  if (cards.error) return <section role="alert" aria-label="观察卡片加载失败"><p>观察手册中的卡片加载失败，请检查网络后重试。</p><button type="button" onClick={cards.retry}>重试加载观察卡片</button></section>;
  if (!handbooks.items.length) return <section aria-label="暂无观察手册">这个小朋友还没有观察手册。</section>;
  const cardsById = new Map(cards.items.map(card => [card.id, card]));
  const openedHandbook = handbooks.items.find(handbook => handbook.id === openedId);
  return <section className="handbook-list-api" aria-label="观察手册">{handbooks.items.map(handbook => {
    const collectedCards = handbook.cardIds.map(id => cardsById.get(id)).filter((card): card is ObservationCardSummary => Boolean(card));
    const selectedCover = handbook.coverPhotoId ? cards.items.flatMap(card => card.photos).find(photo => photo.id === handbook.coverPhotoId) : undefined;
    const cover = selectedCover?.thumbnailUrl ?? collectedCards[0]?.photos[0]?.thumbnailUrl;
    return <article key={handbook.id} className="handbook-tile-api">
      {cover ? <img className="handbook-cover" src={cover} alt={`${handbook.title}封面`} /> : <div className="handbook-cover handbook-cover-placeholder" aria-hidden="true">O</div>}
      <div className="handbook-tile-copy"><p className="handbook-status">{handbook.status === "completed" ? "已完成手册" : "正在观察"}</p><h2>{handbook.title}</h2><p>{handbook.introduction}</p><small>{handbook.startedAt}{handbook.completedAt ? ` — ${handbook.completedAt}` : " — 至今"} · {handbook.cardCount} 张卡片 · {handbook.tagCount} 个主题</small><button className="open-handbook" onClick={() => setOpenedId(handbook.id)}>打开整本手册 →</button>{canPublish && <footer>{handbook.publication ? <><span className="handbook-publication-state">已发布到公共空间</span><button onClick={async () => { setPublishingId(handbook.id); setPublishNotice(""); try { await withdrawPublication(handbook.publication!.id); handbooks.retry(); setPublishNotice(`《${handbook.title}》已撤销发布。`); } catch { setPublishNotice("撤销发布失败，请稍后重试。"); } finally { setPublishingId(null); } }} disabled={publishingId === handbook.id}>{publishingId === handbook.id ? "撤销中…" : "撤销发布"}</button></> : <button onClick={async () => { setPublishingId(handbook.id); setPublishNotice(""); try { await publishHandbook(handbook.id); handbooks.retry(); setPublishNotice(`《${handbook.title}》已发布到公共空间。`); } catch (error) { const message = error instanceof ApiError && error.code === "AUTH_REQUIRED" ? "登录已失效，请重新登录后再发布。" : error instanceof ApiError && error.code === "FAMILY_ADMIN_REQUIRED" ? "只有家庭管理员可以发布到公共空间。" : error instanceof ApiError && error.code === "HANDBOOK_NOT_FOUND" ? "手册不存在或已被移除。" : "发布失败，请稍后重试。"; setPublishNotice(message); } finally { setPublishingId(null); } }} disabled={publishingId === handbook.id}>{publishingId === handbook.id ? "发布中…" : "发布到公共空间"}</button>}</footer>}</div>
    </article>;
  })}{publishNotice && <p className="handbook-publish-notice" role="status">{publishNotice}</p>}{openedHandbook && <HandbookReaderModal handbook={openedHandbook} cards={cards.items} childName={childName} canEdit={canEdit} readOnly={!canEdit} onClose={() => setOpenedId(null)} onSaveOrder={async cardIds => { await updateHandbook(openedHandbook.id, { cardIds }); }} onExport={canEdit ? async (handbookId, kind) => apiClient.createExport(childId, { handbookId, kind }) : undefined} />}</section>;
}

function useChildCollection<T>(childId: string, load: (childId: string) => Promise<T[]>) {
  const [state, setState] = useState<{ items: T[]; loading: boolean; error: boolean }>({ items: [], loading: true, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ items: [], loading: true, error: false });
    void Promise.resolve(load?.(childId) ?? []).then(items => { if (active) setState({ items, loading: false, error: false }); }).catch(() => { if (active) setState({ items: [], loading: false, error: true }); });
    return () => { active = false; };
  }, [childId, load, attempt]);
  return { ...state, retry: () => setAttempt(current => current + 1) };
}
