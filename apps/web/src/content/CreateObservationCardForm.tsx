import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ApiError, apiClient, type HandbookSummary, type ObservationCardSummary, type TagSummary, type TemplateBox, type TemplateLayout, type TemplateSummary } from "../api/client.js";

type CreateObservationCardFormProps = {
  childId: string;
  uploadMedia?: (childId: string, file: File) => Promise<{ id: string }>;
  loadTemplates?: (kind: TemplateSummary["kind"]) => Promise<TemplateSummary[]>;
  createCard?: (childId: string, payload: { observedAt: string; text: string; textBlocks?: string[]; mediaAssetIds: string[]; tagIds: string[]; handbookIds?: string[]; templateId?: string }) => Promise<{ id: string }>;
  createTag?: (childId: string, payload: { name: string; color: string }) => Promise<TagSummary>;
  loadTags?: (childId: string) => Promise<TagSummary[]>;
  loadHandbooks?: (childId: string) => Promise<HandbookSummary[]>;
  handbookRefreshKey?: number;
  onRequestCreateHandbook?: () => void;
  existingCard?: ObservationCardSummary | null;
  updateCard?: (cardId: string, payload: { observedAt?: string; text?: string; textBlocks?: string[]; mediaAssetIds?: string[]; tagIds?: string[]; handbookIds?: string[]; templateId?: string }) => Promise<ObservationCardSummary>;
  onCreated: () => void;
  archiveCard?: (cardId: string) => Promise<void>;
  onArchived?: () => void;
  onCancel?: () => void;
  readOnly?: boolean;
};

const layoutChoices = [["card_1", "一张照片"], ["card_2", "两张照片"], ["card_3", "三张照片"], ["card_4", "四张照片"]] as const;
const position = (box: TemplateBox): CSSProperties => ({ position: "absolute", left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` });

export function CreateObservationCardForm({ childId, uploadMedia = apiClient.uploadMedia, loadTemplates = apiClient.templates, createCard = apiClient.createCard, createTag = apiClient.createTag, updateCard = apiClient.updateCard, archiveCard = apiClient.archiveCard, loadTags = apiClient.tags, loadHandbooks = apiClient.handbooks, handbookRefreshKey = 0, onRequestCreateHandbook, existingCard = null, onCreated, onArchived, onCancel, readOnly = false }: CreateObservationCardFormProps) {
  const [text, setText] = useState(existingCard?.text ?? ""); const [textBlocks, setTextBlocks] = useState<string[]>(existingCard?.textBlocks ?? []); const [slotFiles, setSlotFiles] = useState<Record<number, File>>({}); const [removedPhotoIndexes, setRemovedPhotoIndexes] = useState<number[]>([]); const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null); const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null); const photoInputRef = useRef<HTMLInputElement>(null); const pendingPhotoIndex = useRef(0);
  const [templateKind, setTemplateKind] = useState<TemplateSummary["kind"]>(existingCard?.templateKind ?? `card_${Math.min(Math.max(existingCard?.photos.length ?? 1, 1), 4)}` as TemplateSummary["kind"]); const [templates, setTemplates] = useState<TemplateSummary[]>([]); const [templateId, setTemplateId] = useState(existingCard?.templateId ?? ""); const [notice, setNotice] = useState("");
  const [tags, setTags] = useState<TagSummary[]>([]); const [tagIds, setTagIds] = useState<string[]>(existingCard?.tags.map(tag => tag.id) ?? []);
  const [handbooks, setHandbooks] = useState<HandbookSummary[]>([]); const [handbookIds, setHandbookIds] = useState<string[]>(existingCard?.handbooks?.map(handbook => handbook.id) ?? []);
  const [newTag, setNewTag] = useState("");
  const [isTagCreateOpen, setTagCreateOpen] = useState(false); const [tagCreateName, setTagCreateName] = useState(""); const [isCreatingTag, setCreatingTag] = useState(false); const [pendingTagRemoval, setPendingTagRemoval] = useState<string | null>(null); const tagAreaRef = useRef<HTMLDivElement>(null);
  const [isArchiveConfirmOpen, setArchiveConfirmOpen] = useState(false); const [isArchiving, setArchiving] = useState(false);
  const tagSuggestions = newTag.startsWith("#") ? tags.filter(tag => !tagIds.includes(tag.id) && tag.name.toLocaleLowerCase().includes(newTag.slice(1).trim().toLocaleLowerCase())) : [];
  const [isLayoutDialogOpen, setLayoutDialogOpen] = useState(false);
  useEffect(() => { void loadTags(childId).then(setTags).catch(() => setTags([])); void loadHandbooks(childId).then(setHandbooks).catch(() => setHandbooks([])); }, [childId, handbookRefreshKey, loadHandbooks, loadTags]);
  useEffect(() => { setTemplateId(""); void loadTemplates(templateKind).then(items => { setTemplates(items); setTemplateId(existingCard?.templateId && items.some(item => item.id === existingCard.templateId) ? existingCard.templateId : items[0]?.id ?? ""); }).catch(() => setTemplates([])); }, [loadTemplates, templateKind, existingCard]);
  useEffect(() => { setText(existingCard?.text ?? ""); setTextBlocks(existingCard?.textBlocks ?? []); setTagIds(existingCard?.tags.map(tag => tag.id) ?? []); setHandbookIds(existingCard?.handbooks?.map(handbook => handbook.id) ?? []); }, [existingCard]);
  useEffect(() => {
    if (!pendingTagRemoval) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!tagAreaRef.current?.contains(event.target as Node)) setPendingTagRemoval(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [pendingTagRemoval]);
  const previews = useMemo(() => Object.fromEntries(Object.entries(slotFiles).map(([index, file]) => [index, typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : ""])), [slotFiles]);
  useEffect(() => () => Object.values(previews).forEach(url => { if (url) URL.revokeObjectURL(url); }), [previews]);
  const slotCount = Number(templateKind.slice(-1));
  const activeTemplate = readOnly && existingCard?.templateLayout ? { id: existingCard.templateId ?? "demo-template", name: "公开示例模板", kind: existingCard.templateKind ?? templateKind, state: "published" as const, paperSize: "A5" as const, orientation: "portrait" as const, layout: existingCard.templateLayout } : templates.find(template => template.id === templateId);
  const templateTexts = activeTemplate ? normaliseCardLayout(activeTemplate).texts ?? [] : [];
  const editableTextBlocks = templateTexts.map((item, index) => index === 0 ? text : textBlocks[index] ?? item.content);

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    if (!templateId) { setNotice("先挑一张你喜欢的卡片模板吧。"); return; }
    const filledPhotoCount = Array.from({ length: slotCount }, (_, index) => slotFiles[index] || (!removedPhotoIndexes.includes(index) && existingCard?.photos[index])).filter(Boolean).length;
    if (filledPhotoCount !== slotCount) { setNotice(`这个版式需要 ${slotCount} 张照片，还差 ${slotCount - filledPhotoCount} 张。`); return; }
    try {
      setNotice(existingCard ? "正在保存卡片…" : "正在把卡片收进册子…");
      const filesToUpload = Object.entries(slotFiles).map(([index, file]) => ({ index: Number(index), file }));
      const uploaded = await Promise.all(filesToUpload.map(async item => ({ ...item, mediaId: (await uploadMedia(childId, item.file)).id })));
      const uploadedBySlot = new Map(uploaded.map(item => [item.index, item.mediaId]));
      const mediaAssetIds = Array.from({ length: slotCount }, (_, index) => ({ index, id: uploadedBySlot.get(index) ?? (existingCard?.photos[index]?.id ?? null) })).filter(item => Boolean(item.id) && !removedPhotoIndexes.includes(item.index)).map(item => item.id as string);
      if (existingCard) { await updateCard(existingCard.id, { text: text.trim(), textBlocks: editableTextBlocks, mediaAssetIds, tagIds, handbookIds, templateId }); setNotice("卡片已更新。"); }
      else { if (!mediaAssetIds.length) { setNotice("先点击画布中的照片框，放进一张照片吧。"); return; } await createCard(childId, { observedAt: new Date().toISOString().slice(0, 10), text: text.trim(), textBlocks: editableTextBlocks, mediaAssetIds, tagIds, handbookIds, templateId }); setNotice("记录已保存。"); }
      onCreated();
    } catch (error) {
      const messages: Record<string, string> = { TEMPLATE_SELECTION_INVALID: "模板和照片数量不一致，请重新选择版式或补齐照片。", HANDBOOK_SELECTION_INVALID: "选择的观察手册已变化，请重新选择。", TAG_SELECTION_INVALID: "选择的标签已变化，请重新选择。", CHILD_SCOPE_VIOLATION: "这张照片不能用于当前小朋友的卡片。" };
      setNotice(error instanceof ApiError ? messages[error.code] ?? "保存失败，请稍后重试。" : "保存失败，请稍后重试。");
    }
  }

  const originalPhotos = existingCard?.photos.map(photo => photo.thumbnailUrl) ?? [];
  const previewPhotos = Array.from({ length: slotCount }, (_, index) => previews[index] || (removedPhotoIndexes.includes(index) ? "" : originalPhotos[index] ?? ""));
  function selectPhoto(index: number) { setSelectedPhotoIndex(index); }
  function openPhotoPicker(index: number) { pendingPhotoIndex.current = index; setSelectedPhotoIndex(index); photoInputRef.current?.click(); }
  function onPhotoSelected(event: React.ChangeEvent<HTMLInputElement>) { const file = event.currentTarget.files?.[0]; if (file) { const index = pendingPhotoIndex.current; setSlotFiles(current => ({ ...current, [index]: file })); setRemovedPhotoIndexes(current => current.filter(item => item !== index)); } event.currentTarget.value = ""; }
  function removePhoto(index: number) { setSlotFiles(current => { const next = { ...current }; delete next[index]; return next; }); setRemovedPhotoIndexes(current => current.includes(index) ? current : [...current, index]); setSelectedPhotoIndex(null); }
  async function createAndSelectTag() {
    const name = tagCreateName.trim().replace(/^#+/, "");
    if (!name) { setNotice("先给这个标签起个名字吧。"); return; }
    try {
      setCreatingTag(true);
      const created = await createTag(childId, { name, color: "olive" });
      setTags(current => [...current, created]);
      setTagIds(current => current.includes(created.id) ? current : [...current, created.id]);
      setNewTag(""); setTagCreateOpen(false); setTagCreateName(""); setNotice(`已添加标签 #${created.name}。`);
    } catch (error) {
      const messages: Record<string, string> = { TAG_NAME_CONFLICT: "已经有同名标签了，请从候选中选择。", TAG_NAME_REQUIRED: "标签名称不能为空。" };
      setNotice(error instanceof ApiError ? messages[error.code] ?? "新建标签失败，请稍后重试。" : "新建标签失败，请稍后重试。");
    } finally { setCreatingTag(false); }
  }
  async function archiveCurrentCard() {
    if (!existingCard) return;
    try {
      setArchiving(true);
      await archiveCard(existingCard.id);
      onArchived?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === "CARD_REFERENCED") { setNotice("这张卡片已收入观察手册，请先从手册中移除后再归档。"); }
      else setNotice("归档失败，请稍后重试。");
      setArchiveConfirmOpen(false);
    } finally { setArchiving(false); }
  }
  if (readOnly && existingCard) { const readonlyLayout = activeTemplate ? normaliseCardLayout(activeTemplate) : layoutsFallback(existingCard.templateKind ?? templateKind); return <section className="card-readonly-view" aria-label="观察卡只读查看"><header><div><p>公开示例 · 只读查看</p><h2>查看观察卡</h2><span>{existingCard.observedAt}</span></div><button type="button" aria-label="关闭观察卡" onClick={onCancel}>×</button></header><div className="card-readonly-canvas"><FixedCardCanvas layout={readonlyLayout} photos={previewPhotos} text={text} textBlocks={editableTextBlocks} projectName="我的观察" /></div><div className="card-readonly-meta"><p>{existingCard.text}</p><div>{existingCard.tags.map(tag => <span key={tag.id}>#{tag.name}</span>)}</div></div><footer><button type="button" onClick={onCancel}>返回今日记录</button></footer></section>; }
  return <form className={`card-composer kid-card-composer wysiwyg-card-composer${readOnly ? " demo-readonly" : ""}`} onSubmit={saveCard}>
    <header><div><p>{readOnly ? "公开示例 · 只读查看" : "我的观察工作台"}</p><h2>{readOnly ? "查看观察卡" : existingCard ? "编辑观察卡" : "做一张观察卡"}</h2><span>点击画布中的照片或文字即可直接编辑</span></div><button type="button" aria-label="关闭编辑观察卡" onClick={onCancel}>×</button></header>
    <div className="wysiwyg-card-layout">
      <section className="canvas-stage" aria-label="观察卡实时预览" onClick={event => { if (event.target === event.currentTarget) { setSelectedPhotoIndex(null); setEditingTextIndex(null); } }}><p>实时预览 · 点击照片进入操作，点击文字直接编辑</p>{activeTemplate ? <FixedCardCanvas layout={normaliseCardLayout(activeTemplate)} photos={previewPhotos} text={text} textBlocks={editableTextBlocks} projectName="我的观察" editable={!readOnly} selectedPhotoIndex={selectedPhotoIndex} editingTextIndex={editingTextIndex} onPhotoClick={(index, hasPhoto) => hasPhoto ? selectPhoto(index) : openPhotoPicker(index)} onPhotoReplace={openPhotoPicker} onPhotoRemove={removePhoto} onTextClick={index => { setEditingTextIndex(index); setSelectedPhotoIndex(null); }} onTextBlur={() => setEditingTextIndex(null)} onTextChange={(index, value) => index === 0 ? setText(value) : setTextBlocks(current => { const next = [...current]; next[index] = value; return next; })} /> : <div className="empty-card-canvas">先在右边选一张模板<br />画布就会出现。</div>}<input ref={photoInputRef} className="canvas-photo-input" aria-label="选择照片" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoSelected} /></section>
      <section className="card-edit-desk" aria-label={readOnly ? "观察卡只读内容" : "观察卡编辑台"} onClick={() => { setSelectedPhotoIndex(null); setEditingTextIndex(null); }}>
        <div className="desk-section compact-template-section"><b>卡片版式</b>{readOnly ? <div className="card-layout-current"><span><strong>{activeTemplate?.name ?? "公开示例模板"}</strong><small>已按原模板排版</small></span></div> : <button type="button" className="card-layout-trigger" onClick={() => setLayoutDialogOpen(true)}><span><strong>{activeTemplate?.name ?? "请选择模板"}</strong><small>{layoutChoices.find(([kind]) => kind === templateKind)?.[1] ?? "选择照片数量"} · 照片格固定在模板位置</small></span><b>更换版式&nbsp; →</b></button>}</div>
        <div className="desk-section metadata-section"><b>整理这张卡片</b><div className="metadata-control"><span>标签</span><div className="choice-chips" ref={tagAreaRef}>{tagIds.map(id => { const tag = tags.find(item => item.id === id) ?? existingCard?.tags.find(item => item.id === id); return tag ? <span className="tag-chip-wrap" key={id}><button type="button" className="selected" aria-label={`#${tag.name}`} onClick={event => { event.stopPropagation(); setPendingTagRemoval(current => current === id ? null : id); }}>#{tag.name}</button>{pendingTagRemoval === id && <span className="tag-remove-popover" role="dialog" aria-label="删除标签" onPointerDown={event => event.stopPropagation()}><span>要移除 #{tag.name} 吗？</span><button type="button" onClick={() => { setTagIds(current => current.filter(item => item !== id)); setPendingTagRemoval(null); }}>确认删除标签</button><button type="button" onClick={() => setPendingTagRemoval(null)}>取消</button></span>}</span> : null; })}<label className="new-tag-input"><input aria-label="搜索标签" value={newTag} onChange={event => setNewTag(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && tagSuggestions[0]) { event.preventDefault(); setTagIds(current => [...current, tagSuggestions[0].id]); setNewTag(""); } if (event.key === "Escape") setNewTag(""); }} placeholder="输入 # 选择标签" />{newTag.startsWith("#") && <div className="tag-suggestions" role="listbox" aria-label="标签候选">{tagSuggestions.length ? tagSuggestions.map(tag => <button type="button" role="option" key={tag.id} onClick={() => { setTagIds(current => [...current, tag.id]); setNewTag(""); }}>#{tag.name}<small>{tag.cardCount} 张卡片</small></button>) : <button type="button" onClick={() => { setTagCreateName(newTag.slice(1).trim()); setTagCreateOpen(true); }}>新建标签「{newTag.slice(1).trim()}」</button>}</div>}</label></div></div><div className="metadata-control"><span>观察手册</span><div className="handbook-picker"><div className="handbook-options" aria-label="选择观察手册">{handbooks.length ? handbooks.map(handbook => <label key={handbook.id}><input type="checkbox" aria-label={handbook.title} checked={handbookIds.includes(handbook.id)} onChange={event => setHandbookIds(current => event.target.checked ? [...current, handbook.id] : current.filter(id => id !== handbook.id))} />{handbook.title}</label>) : <span>暂不归入手册</span>}</div><button type="button" onClick={onRequestCreateHandbook}>＋ 新建手册</button></div></div></div>
      </section>
    </div>
    <footer><span>{notice}</span>{existingCard && !readOnly && <button type="button" className="archive-card-link" onClick={() => setArchiveConfirmOpen(true)}>归档卡片</button>}<button type="button" onClick={onCancel}>{readOnly || existingCard ? "返回今日记录" : "放弃这张卡片"}</button>{!readOnly && <button className="save-card" type="submit">{existingCard ? "保存修改" : "收进我的观察册 ✦"}</button>}</footer>
    {isLayoutDialogOpen && !readOnly && <div className="layout-picker-backdrop" role="presentation" onMouseDown={() => setLayoutDialogOpen(false)}><section className="card-layout-dialog" role="dialog" aria-modal="true" aria-label="选择卡片版式" onMouseDown={event => event.stopPropagation()}><div className="card-layout-dialog-bar"><h3>选择卡片版式</h3><button type="button" aria-label="关闭版式选择" onClick={() => setLayoutDialogOpen(false)}>×</button></div><div className="layout-choice-row">{layoutChoices.map(([kind, title]) => <button key={kind} type="button" className={templateKind === kind ? "selected" : ""} onClick={() => setTemplateKind(kind)}>{title}</button>)}</div><div className="template-thumb-grid" aria-label="模板选项">{templates.map(template => <button key={template.id} type="button" className={template.id === templateId ? "selected" : ""} aria-label={`选择模板：${template.name}`} onClick={() => setTemplateId(template.id)}><TemplateThumbnail layout={normaliseCardLayout(template)} /><strong>{template.name}</strong></button>)}</div>{!templates.length && <p className="card-layout-dialog-note">暂无可用模板，请先联系家庭管理员。</p>}<div className="card-layout-dialog-footer"><span>{templateId ? "已选择一个模板" : "请选择一个模板"}</span><button type="button" className="confirm-layout" disabled={!templateId} onClick={() => setLayoutDialogOpen(false)}>确认选择</button></div></section></div>}
    {isTagCreateOpen && <div className="layout-picker-backdrop" role="presentation" onMouseDown={() => setTagCreateOpen(false)}><section className="card-layout-dialog tag-create-dialog" role="dialog" aria-modal="true" aria-label="新建标签" onMouseDown={event => event.stopPropagation()}><div className="card-layout-dialog-bar"><h3>新建标签</h3><button type="button" aria-label="关闭新建标签" onClick={() => setTagCreateOpen(false)}>×</button></div><label>标签名称<input aria-label="新标签名称" value={tagCreateName} onChange={event => setTagCreateName(event.target.value)} autoFocus /></label><p>创建后会立刻选中这枚标签，也能在“标签管理”中改名或删除未使用的标签。</p><div className="card-layout-dialog-footer"><button type="button" onClick={() => setTagCreateOpen(false)}>取消</button><button type="button" className="confirm-layout" disabled={isCreatingTag} onClick={() => void createAndSelectTag()}>创建并选中</button></div></section></div>}
    {isArchiveConfirmOpen && <div className="layout-picker-backdrop" role="presentation" onMouseDown={() => setArchiveConfirmOpen(false)}><section className="card-layout-dialog archive-confirm-dialog" role="dialog" aria-modal="true" aria-label="确认归档卡片" onMouseDown={event => event.stopPropagation()}><div className="card-layout-dialog-bar"><h3>归档这张卡片？</h3><button type="button" aria-label="关闭归档确认" onClick={() => setArchiveConfirmOpen(false)}>×</button></div><p>归档后它会从“今日记录”中隐藏，但不会影响已收入的观察手册。</p><div className="card-layout-dialog-footer"><button type="button" onClick={() => setArchiveConfirmOpen(false)}>取消</button><button type="button" className="archive-confirm" disabled={isArchiving} onClick={() => void archiveCurrentCard()}>{isArchiving ? "归档中…" : "确认归档"}</button></div></section></div>}
  </form>;
}

function FixedCardCanvas({ layout, photos, text, textBlocks = [], projectName, editable = false, selectedPhotoIndex = null, editingTextIndex = null, onPhotoClick, onPhotoReplace, onPhotoRemove, onTextClick, onTextBlur, onTextChange }: { layout: TemplateLayout; photos: string[]; text: string; textBlocks?: string[]; projectName: string; editable?: boolean; selectedPhotoIndex?: number | null; editingTextIndex?: number | null; onPhotoClick?: (index: number, hasPhoto: boolean) => void; onPhotoReplace?: (index: number) => void; onPhotoRemove?: (index: number) => void; onTextClick?: (index: number) => void; onTextBlur?: () => void; onTextChange?: (index: number, value: string) => void }) {
  const texts = layout.texts ?? [];
  return <article className="fixed-card-canvas" style={{ position: "relative" }}>
    {(layout.photos ?? []).map((frame, index) => <div key={frame.id} className={`fixed-card-photo-slot${selectedPhotoIndex === index ? " selected" : ""}`} style={position(frame)} onClick={event => { event.stopPropagation(); editable && onPhotoClick?.(index, Boolean(photos[index])); }}>{photos[index] ? <img className="fixed-card-photo" src={photos[index]} alt={`第 ${index + 1} 张待保存照片`} /> : <span className="fixed-card-photo empty" style={{ position: "absolute", inset: 0 }}>＋ 照片 {index + 1}</span>}{editable && selectedPhotoIndex === index && <span className="canvas-photo-actions"><button type="button" onClick={event => { event.stopPropagation(); onPhotoReplace?.(index); }}>更换</button>{photos[index] && <button type="button" onClick={event => { event.stopPropagation(); onPhotoRemove?.(index); }}>删除</button>}</span>}</div>)}
    {(layout.lines ?? []).map(line => <i key={line.id} className="fixed-card-line" style={{ position: "absolute", left: `${line.x}%`, top: `${line.y}%`, width: `${line.width}%`, height: `${line.thickness ?? 1}px`, background: line.color }} />)}
    {texts.map((item, index) => editable && editingTextIndex === index ? <textarea key={item.id} autoFocus aria-label={index === 0 ? "写下发现" : `编辑文字框 ${index + 1}`} className="fixed-card-text fixed-card-text-editor" style={{ ...position(item), color: item.color, fontSize: `${item.fontSize}px`, textAlign: layout.textAlign }} value={textBlocks[index] ?? (index === 0 ? text : "")} onChange={event => onTextChange?.(index, event.target.value)} onBlur={onTextBlur} onClick={event => event.stopPropagation()} /> : <span key={item.id} className="fixed-card-text" style={{ ...position(item), color: item.color, fontSize: `${item.fontSize}px`, textAlign: layout.textAlign }} onClick={event => { event.stopPropagation(); editable && onTextClick?.(index); }}>{textBlocks[index] || (index === 0 ? text || item.content : item.content.replace("{项目}", projectName).replace("{发现}", text || "我的发现"))}</span>)}
  </article>;
}

function TemplateThumbnail({ layout }: { layout: TemplateLayout }) {
  return <i className="template-layout-thumbnail" style={{ position: "relative" }} aria-hidden="true">{(layout.photos ?? []).map(photo => <em key={photo.id} style={position(photo)} />)}{(layout.lines ?? []).map(line => <b key={line.id} style={{ position: "absolute", left: `${line.x}%`, top: `${line.y}%`, width: `${line.width}%`, height: `${line.thickness ?? 1}px`, background: line.color }} />)}{(layout.texts ?? []).slice(0, 2).map(item => <small key={item.id} style={{ ...position(item), background: item.color }} />)}</i>;
}

function normaliseCardLayout(template: TemplateSummary): TemplateLayout {
  const saved = template.layout ?? { preset: "standard", safeMarginMm: 10, textAlign: "left" };
  return { ...saved, photos: saved.photos?.length ? saved.photos : photoFrames(template.kind), texts: saved.texts?.length ? saved.texts : [{ id: "observation-text", content: "我发现了什么？", x: 10, y: 74, width: 80, height: 14, fontSize: 12, color: "#254c3c" }], lines: saved.lines ?? [] };
}

function layoutsFallback(kind: TemplateSummary["kind"]): TemplateLayout {
  return normaliseCardLayout({ id: "fallback", name: "示例模板", kind, state: "published", paperSize: "A5", orientation: "portrait", layout: { preset: "standard", safeMarginMm: 10, textAlign: "left" } });
}

function photoFrames(kind: TemplateSummary["kind"]): TemplateBox[] {
  if (kind === "card_1") return [{ id: "photo-1", x: 10, y: 10, width: 80, height: 58 }];
  if (kind === "card_2") return [{ id: "photo-1", x: 10, y: 10, width: 38, height: 58 }, { id: "photo-2", x: 52, y: 10, width: 38, height: 58 }];
  if (kind === "card_3") return [{ id: "photo-1", x: 10, y: 10, width: 80, height: 32 }, { id: "photo-2", x: 10, y: 46, width: 38, height: 22 }, { id: "photo-3", x: 52, y: 46, width: 38, height: 22 }];
  return [{ id: "photo-1", x: 10, y: 10, width: 38, height: 27 }, { id: "photo-2", x: 52, y: 10, width: 38, height: 27 }, { id: "photo-3", x: 10, y: 41, width: 38, height: 27 }, { id: "photo-4", x: 52, y: 41, width: 38, height: 27 }];
}
