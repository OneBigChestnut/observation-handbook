import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { templateColors, type TemplateBox, type TemplateColor, type TemplateLayout, type TemplateLine, type TemplateSummary, type TemplateText } from "../api/client.js";

type Kind = TemplateSummary["kind"];
const kinds: { id: Kind; label: string; photos: number }[] = [
  { id: "cover", label: "封面", photos: 0 }, { id: "back", label: "封底", photos: 0 },
  { id: "card_1", label: "1 张图", photos: 1 }, { id: "card_2", label: "2 张图", photos: 2 },
  { id: "card_3", label: "3 张图", photos: 3 }, { id: "card_4", label: "4 张图", photos: 4 },
];
const defaultLayout = (kind: Kind): TemplateLayout => ({ preset: "standard", safeMarginMm: 10, textAlign: "left", photos: photoFrames(kind), texts: [{ id: "text-1", content: kind === "cover" ? "观察手册" : "日期 · 观察文字", x: 10, y: 78, width: 76, height: 10, fontSize: 12, color: "#254c3c" }], lines: [] });

export function TemplateManagementPage({ loadTemplates, createTemplate, updateTemplate, publishTemplate, removeTemplate }: { loadTemplates: () => Promise<TemplateSummary[]>; createTemplate: (payload: Pick<TemplateSummary, "name" | "kind" | "state" | "layout">) => Promise<TemplateSummary>; updateTemplate: (id: string, payload: Partial<Pick<TemplateSummary, "name" | "state" | "layout">>) => Promise<TemplateSummary>; publishTemplate: (id: string) => Promise<TemplateSummary>; removeTemplate: (id: string) => Promise<void> }) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]); const [kind, setKind] = useState<Kind>("cover"); const [editor, setEditor] = useState<TemplateSummary | null>(null); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true);
  const selected = useMemo(() => templates.filter(template => template.kind === kind), [templates, kind]);
  const reload = () => { setLoading(true); setNotice(""); void loadTemplates().then(items => { setTemplates(items); setLoading(false); }).catch(() => { setLoading(false); setNotice("模板目录暂时无法读取。请确认以超级管理员登录后重新读取。"); }); };
  useEffect(() => { reload(); }, [loadTemplates]);
  const openNew = () => setEditor({ id: "", name: `${kinds.find(item => item.id === kind)?.label} · 新模板`, kind, state: "draft", paperSize: "A5", orientation: "portrait", layout: defaultLayout(kind) });
  const save = async (draft: TemplateSummary): Promise<TemplateSummary> => {
    try {
      const isNew = !draft.id; const mustVersion = !isNew && draft.state !== "draft";
      const result = isNew || mustVersion ? await createTemplate({ name: draft.name.trim() || "未命名模板", kind: draft.kind, state: "draft", layout: draft.layout }) : await updateTemplate(draft.id, { name: draft.name.trim() || draft.name, layout: draft.layout });
      // Re-read the server list after saving so the page reflects the persisted version,
      // including the new draft created when a published template is edited.
      const persisted = await loadTemplates();
      // Keep the exact layout just submitted when reconciling the server list.
      // This prevents a stale list response from replacing the newly saved canvas.
      const saved = { ...result, layout: draft.layout };
      const refreshed = persisted.some(item => item.id === saved.id) ? persisted.map(item => item.id === saved.id ? saved : item) : [...persisted, saved];
      setTemplates(refreshed); setNotice(mustVersion ? "已基于当前版本创建可编辑草稿；可继续调整后发布。" : "模板已保存，可继续编辑。"); return saved;
    } catch (error) { setNotice("模板无法保存，请检查模板内容后重试。"); throw error; }
  };
  const remove = async (template: TemplateSummary) => { await removeTemplate(template.id); setTemplates(items => items.filter(item => item.id !== template.id)); setNotice(template.state === "published" ? "模板已停用；已被使用的版本会保留在历史中。" : "模板已删除。"); };
  return <section className="template-management" aria-label="模板管理">
    <header><p>全局出版模板</p><h1>模板工作台</h1><span>先选择内容种类，再维护该类模板。每一页固定为 A5 竖版。</span></header>
    {loading ? <p role="status">正在读取模板目录…</p> : <>
      <div className="template-kind-tabs" role="tablist" aria-label="模板种类">{kinds.map(item => <button key={item.id} role="tab" aria-selected={kind === item.id} onClick={() => setKind(item.id)}>{item.label} <b>{templates.filter(template => template.kind === item.id).length}</b></button>)}</div>
      {notice && <p role="status" className="template-notice">{notice}<button type="button" onClick={reload}>重新读取</button></p>}
      <div className="template-section-heading"><div><p>{kinds.find(item => item.id === kind)?.label}</p><h2>共 {selected.length} 个模板</h2></div><button className="template-primary" onClick={openNew}>新增模板</button></div>
      <div className="template-gallery">{selected.map(template => <article className="template-thumbnail" key={template.id}><TemplateThumbnail layout={normalise(template)} kind={template.kind} /><footer><strong>{template.name}</strong><span className="template-version-status">{stateLabel(template.state)}</span><button onClick={() => setEditor({ ...template, layout: normalise(template) })}>修改</button>{template.state === "draft" && <button onClick={async () => { const result = await publishTemplate(template.id); setTemplates(items => items.map(item => item.id === result.id ? result : item)); }}>发布</button>}<button className="delete-export" onClick={() => void remove(template)}>删除</button></footer></article>)}</div>
      {!selected.length && <div className="template-empty"><b>还没有{kindLabel(kind)}模板</b><span>从一份可编辑的 A5 草稿开始，添加照片格、文字和装饰线。</span><button onClick={openNew}>新增第一份模板</button></div>}
      {editor && <TemplateEditor draft={editor} onClose={() => setEditor(null)} onSave={save} />}
    </>}
  </section>;
}

function TemplateEditor({ draft, onClose, onSave }: { draft: TemplateSummary; onClose: () => void; onSave: (template: TemplateSummary) => Promise<TemplateSummary> }) {
  const [value, setValue] = useState(draft); const [selectedPhoto, setSelectedPhoto] = useState(0); const [selectedText, setSelectedText] = useState<string | null>(null); const [selectedLine, setSelectedLine] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState(""); const layout = normalise(value); const selectedTextItem = layout.texts?.find(text => text.id === selectedText); const selectedLineItem = layout.lines?.find(line => line.id === selectedLine);
  const hasSelection = selectedPhoto >= 0 || selectedText !== null || selectedLine !== null;
  const deleteSelected = () => { if (selectedPhoto >= 0) { setValue(item => ({ ...item, layout: { ...layout, photos: layout.photos?.filter((_, index) => index !== selectedPhoto) } })); setSelectedPhoto(-1); return; } if (selectedText !== null) { setValue(item => ({ ...item, layout: { ...layout, texts: layout.texts?.filter(entry => entry.id !== selectedText) } })); setSelectedText(null); return; } if (selectedLine !== null) { setValue(item => ({ ...item, layout: { ...layout, lines: layout.lines?.filter(entry => entry.id !== selectedLine) } })); setSelectedLine(null); } };
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (event.key !== "Delete" || !hasSelection || target?.matches("input, textarea, select, [contenteditable='true']")) return; event.preventDefault(); deleteSelected(); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [hasSelection, selectedPhoto, selectedText, selectedLine, layout]);
  const addPhoto = () => { const photos = layout.photos ?? []; const next = nextPhotoFrame(photos.length); setValue(item => ({ ...item, layout: { ...layout, photos: [...photos, next] } })); setSelectedPhoto(photos.length); };
  const addText = () => { const id = crypto.randomUUID(); setValue(item => ({ ...item, layout: { ...layout, texts: [...(layout.texts ?? []), { id, content: "新的文字", x: 12, y: 62, width: 65, height: 9, fontSize: 14, color: "#254c3c" }] } })); setSelectedText(id); };
  const addLine = () => { const id = crypto.randomUUID(); setValue(item => ({ ...item, layout: { ...layout, lines: [...(layout.lines ?? []), { id, x: 12, y: 73, width: 70, color: "#57806a", thickness: 1 }] } })); setSelectedLine(id); setSelectedPhoto(-1); setSelectedText(null); };
  return <div className="template-editor-backdrop" role="presentation"><section className="template-editor" role="dialog" aria-label={`编辑 ${kindLabel(value.kind)}模板`} aria-modal="true">
    <header><div><p>{value.id ? "修改模板" : "新增模板"}</p><h2>编辑 {kindLabel(value.kind)}模板</h2></div><button aria-label="关闭编辑器" onClick={onClose}>×</button></header>
    <div className="template-editor-body"><div className="template-canvas-wrap"><TemplateCanvas layout={layout} kind={value.kind} editable selectedPhoto={selectedPhoto} selectedText={selectedText} selectedLine={selectedLine} onSelectPhoto={index => { setSelectedPhoto(index); setSelectedText(null); setSelectedLine(null); }} onSelectText={id => { setSelectedText(id); setSelectedPhoto(-1); setSelectedLine(null); }} onSelectLine={id => { setSelectedLine(id); setSelectedPhoto(-1); setSelectedText(null); }} onChangePhoto={(index, next) => setValue(item => ({ ...item, layout: { ...layout, photos: layout.photos?.map((photo, photoIndex) => photoIndex === index ? next : photo) } }))} onChangeText={(id, next) => setValue(item => ({ ...item, layout: { ...layout, texts: layout.texts?.map(text => text.id === id ? { ...text, ...next } : text) } }))} onChangeLine={(id, next) => setValue(item => ({ ...item, layout: { ...layout, lines: layout.lines?.map(line => line.id === id ? { ...line, ...next } : line) } }))} /></div><aside>
      <label>模板名称<input value={value.name} onChange={event => setValue(item => ({ ...item, name: event.target.value }))} /></label>
      <section className="editor-tools canvas-help"><h3>照片框</h3><button type="button" className="add-photo-frame" onClick={addPhoto}>＋ 增加照片框</button><p>照片框只在左侧画布上拖动、缩放和对齐。</p></section>
      <section className="editor-tools"><h3>文字与装饰</h3><div><button type="button" onClick={addText}>添加文字框</button><button type="button" onClick={addLine}>添加装饰线</button></div>{selectedTextItem ? <SelectedTextControl text={selectedTextItem} onChange={next => setValue(item => ({ ...item, layout: { ...layout, texts: layout.texts?.map(entry => entry.id === selectedTextItem.id ? { ...entry, ...next } : entry) } }))} /> : selectedLineItem ? <LineControl line={selectedLineItem} onChange={next => setValue(item => ({ ...item, layout: { ...layout, lines: layout.lines?.map(entry => entry.id === selectedLineItem.id ? next : entry) } }))} /> : <p>点击画布上的文字框或装饰线，右侧显示当前对象的控制项。</p>}</section>
      {hasSelection && <button type="button" className="delete-selected-element" onClick={deleteSelected}>删除当前选中</button>}
      <p className="editor-note">画布点阵为 2.5% 间距；拖动和缩放会自动吸附到点阵。右侧只显示当前选中的文字框。</p>
    </aside></div>
    {saveError && <p className="template-save-error" role="alert">{saveError}</p>}<footer><button type="button" onClick={onClose}>关闭编辑器</button><button type="button" className="template-primary" disabled={saving} onClick={async () => { setSaving(true); setSaveError(""); const localLayout = layout; try { const saved = await onSave({ ...value, layout: localLayout }); setValue(current => ({ ...current, id: saved.id, state: saved.state, paperSize: saved.paperSize, orientation: saved.orientation, layout: localLayout })); } catch { setSaveError("保存失败：请确认已登录超级管理员，并检查模板布局后重试。"); } finally { setSaving(false); } }}>{saving ? "保存中…" : value.id && value.state !== "draft" ? "保存为草稿" : "保存模板"}</button></footer>
  </section></div>;
}

const textSizeOptions = Array.from({ length: 21 }, (_, index) => 8 + index * 2);
function SelectedTextControl({ text, onChange }: { text: TemplateText; onChange: (next: Partial<TemplateText>) => void }) { return <div className="selected-text-control"><label>文字内容<input aria-label="文字内容" value={text.content} onChange={event => onChange({ content: event.target.value })} /></label><label>字号<select aria-label="文字字号" value={text.fontSize} onChange={event => onChange({ fontSize: Number(event.target.value) })}>{textSizeOptions.map(size => <option key={size} value={size}>{size}号</option>)}</select></label><div className="selected-text-color"><span>颜色</span><ColorPicker value={text.color} onChange={color => onChange({ color })} /></div></div>; }
function LineControl({ line, onChange }: { line: TemplateLine; onChange: (line: TemplateLine) => void }) { const thickness = line.thickness ?? 1; return <div className="selected-line-control"><div className="line-control-heading"><span>当前装饰线</span></div><label>粗细<div className="line-thickness-options">{[1, 2, 3].map(size => <button type="button" key={size} aria-label={`装饰线粗细 ${size}`} className={thickness === size ? "selected" : ""} onClick={() => onChange({ ...line, thickness: size })}>{size}px</button>)}</div></label><div className="selected-text-color"><span>颜色</span><ColorPicker value={line.color} onChange={color => onChange({ ...line, color })} /></div></div>; }
function ColorPicker({ value, onChange }: { value: TemplateColor; onChange: (color: TemplateColor) => void }) { return <div className="template-colors" aria-label="协调色板">{templateColors.map(color => <button type="button" key={color} aria-label={`颜色 ${color}`} className={value === color ? "selected" : ""} style={{ background: color }} onClick={() => onChange(color)} />)}</div>; }
function TemplateThumbnail({ layout, kind }: { layout: TemplateLayout; kind: Kind }) { return <div className={`template-thumbnail-preview template-thumbnail-${kind}`} aria-label="模板缩略图">{(layout.photos ?? []).map((photo, index) => <span key={photo.id} className="template-thumbnail-photo" style={boxStyle(photo)}>{photo.imageUrl ? <img src={photo.imageUrl} alt="模板照片" /> : <b>{index + 1}</b>}</span>)}{(layout.lines ?? []).map(line => <i key={line.id} className="template-thumbnail-line" style={{ left: `${line.x}%`, top: `${line.y}%`, width: `${line.width}%`, height: `${line.thickness ?? 1}px`, background: line.color }} />)}{(layout.texts ?? []).map(text => <span key={text.id} className="template-thumbnail-text" style={{ ...boxStyle(text), color: text.color, fontSize: `${Math.max(5, text.fontSize * .42)}px` }}>{text.content}</span>)}{!(layout.texts?.length) && <span className="template-thumbnail-title">{kind === "back" ? "观察手册 · 记录" : "观察手册"}</span>}</div>; }
function TemplateCanvas({ layout, kind, compact = false, editable = false, selectedPhoto, selectedText, selectedLine, onSelectPhoto, onSelectText, onSelectLine, onChangePhoto, onChangeText, onChangeLine }: { layout: TemplateLayout; kind: Kind; compact?: boolean; editable?: boolean; selectedPhoto?: number; selectedText?: string | null; selectedLine?: string | null; onSelectPhoto?: (index: number) => void; onSelectText?: (id: string) => void; onSelectLine?: (id: string) => void; onChangePhoto?: (index: number, box: TemplateBox) => void; onChangeText?: (id: string, box: Partial<TemplateText>) => void; onChangeLine?: (id: string, line: TemplateLine) => void }) {
  return <div className={`template-canvas ${compact ? "compact" : ""} ${editable ? "editable" : ""}`} aria-label="模板版式预览">{(layout.photos ?? []).map((photo, index) => <CanvasElement key={photo.id} box={photo} label={`照片格 ${index + 1}`} photoUrl={photo.imageUrl} selected={selectedPhoto === index} editable={editable} onSelect={() => onSelectPhoto?.(index)} onChange={next => onChangePhoto?.(index, next)} />)}{(layout.lines ?? []).map(line => editable ? <CanvasLine key={line.id} line={line} selected={selectedLine === line.id} onSelect={() => onSelectLine?.(line.id)} onChange={next => onChangeLine?.(line.id, next)} /> : <i key={line.id} className="canvas-line" style={{ left: `${line.x}%`, top: `${line.y}%`, width: `${line.width}%`, height: `${line.thickness ?? 1}px`, background: line.color }} />)}{(layout.texts ?? []).map(text => <CanvasElement key={text.id} box={text} label="文字框" selected={selectedText === text.id} editable={editable} onSelect={() => onSelectText?.(text.id)} onChange={next => onChangeText?.(text.id, next)}><span className="canvas-text-content" style={{ color: text.color, fontSize: `${text.fontSize}px` }}>{text.content}</span></CanvasElement>)}{kind === "cover" && !(layout.texts?.length) && <span className="canvas-text">观察手册</span>}</div>;
}

const GRID_SIZE = 2.5;
function snap(value: number) { return Math.max(0, Math.min(100, Math.round(value / GRID_SIZE) * GRID_SIZE)); }
function snapWithin(value: number, min: number, max: number) { return Math.max(min, Math.min(max, snap(value))); }
function CanvasElement({ box, label, photoUrl, selected, editable, onSelect, onChange, children }: { box: TemplateBox; label: string; photoUrl?: string; selected: boolean; editable: boolean; onSelect: () => void; onChange: (box: TemplateBox) => void; children?: React.ReactNode }) {
  const canvasRef = useRef<HTMLButtonElement | HTMLSpanElement>(null);
  const interaction = useRef<{ mode: "move" | "resize"; startX: number; startY: number; box: TemplateBox } | null>(null);
  const start = (event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (!editable) { onSelect(); return; }
    event.preventDefault(); event.stopPropagation(); onSelect();
    const canvas = event.currentTarget.closest(".template-canvas"); if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    interaction.current = { mode, startX: event.clientX, startY: event.clientY, box: { ...box } };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const move = (nextEvent: PointerEvent) => {
      const active = interaction.current; if (!active) return;
      const dx = ((nextEvent.clientX - active.startX) / rect.width) * 100; const dy = ((nextEvent.clientY - active.startY) / rect.height) * 100;
      if (active.mode === "move") onChange({ ...active.box, x: snap(active.box.x + dx), y: snap(active.box.y + dy) });
      else onChange({ ...active.box, width: Math.max(GRID_SIZE, snap(active.box.width + dx)), height: Math.max(GRID_SIZE, snap(active.box.height + dy)) });
    };
    const end = () => { interaction.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };
  const Element = children ? "span" : "button";
  return <Element ref={canvasRef as never} type={children ? undefined : "button"} aria-label={label} className={`${children ? "canvas-text" : "canvas-photo"} ${selected ? "selected" : ""}`} style={boxStyle(box)} onPointerDown={event => start(event, "move")} onClick={onSelect}>{photoUrl && <img src={photoUrl} alt="模板照片" />}{children}{editable && selected && <span className="canvas-resize-handle" aria-label={`调整${label}大小`} onPointerDown={event => start(event, "resize")} />}</Element>;
}
function CanvasLine({ line, selected, onSelect, onChange }: { line: TemplateLine; selected: boolean; onSelect: () => void; onChange: (line: TemplateLine) => void }) {
  const interaction = useRef<{ mode: "move" | "start" | "end"; startX: number; startY: number; line: TemplateLine } | null>(null);
  const start = (event: ReactPointerEvent<HTMLElement>, mode: "move" | "start" | "end") => {
    event.preventDefault(); event.stopPropagation(); onSelect();
    const canvas = event.currentTarget.closest(".template-canvas"); if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); interaction.current = { mode, startX: event.clientX, startY: event.clientY, line: { ...line } };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const move = (nextEvent: PointerEvent) => {
      const active = interaction.current; if (!active) return;
      const dx = ((nextEvent.clientX - active.startX) / rect.width) * 100; const dy = ((nextEvent.clientY - active.startY) / rect.height) * 100; const base = active.line;
      if (active.mode === "move") onChange({ ...base, x: snapWithin(base.x + dx, 0, 100 - base.width), y: snapWithin(base.y + dy, 0, 100) });
      else if (active.mode === "start") { const nextX = snapWithin(base.x + dx, 0, base.x + base.width - GRID_SIZE); onChange({ ...base, x: nextX, width: base.x + base.width - nextX }); }
      else onChange({ ...base, width: snapWithin(base.width + dx, GRID_SIZE, 100 - base.x) });
    };
    const end = () => { interaction.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };
  return <span className={`canvas-line canvas-line-editable ${selected ? "selected" : ""}`} style={{ left: `${line.x}%`, top: `${line.y}%`, width: `${line.width}%` }} onPointerDown={event => start(event, "move")} onClick={onSelect} aria-label="装饰线"><b className="canvas-line-visual" style={{ height: `${line.thickness ?? 1}px`, background: line.color }} /><i className="canvas-line-handle canvas-line-handle-start" aria-label="调整装饰线起点" onPointerDown={event => start(event, "start")} /><i className="canvas-line-handle canvas-line-handle-end" aria-label="调整装饰线终点" onPointerDown={event => start(event, "end")} /></span>;
}
function normalise(template: Pick<TemplateSummary, "kind" | "layout">): TemplateLayout { const fallback = defaultLayout(template.kind); const saved = template.layout ?? {}; return { ...fallback, ...saved, photos: saved.photos ?? fallback.photos, texts: saved.texts ?? fallback.texts, lines: saved.lines ?? fallback.lines }; }
function photoFrames(kind: Kind): TemplateBox[] { const quantity = kinds.find(item => item.id === kind)?.photos ?? 0; if (quantity === 1) return [{ id: "photo-1", x: 10, y: 10, width: 80, height: 55 }]; if (quantity === 2) return [{ id: "photo-1", x: 10, y: 10, width: 38, height: 55 }, { id: "photo-2", x: 52, y: 10, width: 38, height: 55 }]; if (quantity === 3) return [{ id: "photo-1", x: 10, y: 10, width: 80, height: 30 }, { id: "photo-2", x: 10, y: 44, width: 38, height: 21 }, { id: "photo-3", x: 52, y: 44, width: 38, height: 21 }]; if (quantity === 4) return [{ id: "photo-1", x: 10, y: 10, width: 38, height: 27 }, { id: "photo-2", x: 52, y: 10, width: 38, height: 27 }, { id: "photo-3", x: 10, y: 41, width: 38, height: 27 }, { id: "photo-4", x: 52, y: 41, width: 38, height: 27 }]; return []; }
function nextPhotoFrame(index: number): TemplateBox { const columns = index % 2; const row = Math.floor(index / 2); return { id: crypto.randomUUID(), x: columns ? 52 : 10, y: 10 + row * 27, width: 38, height: 22 }; }
function boxStyle(box: TemplateBox) { return { left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` }; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function kindLabel(kind: Kind) { return kinds.find(item => item.id === kind)?.label ?? "模板"; }
function stateLabel(state: TemplateSummary["state"]) { return state === "published" ? "已发布" : state === "draft" ? "草稿" : "已停用"; }
function labelFor(field: keyof TemplateBox) { return ({ x: "横向位置", y: "纵向位置", width: "宽度", height: "高度", id: "" } as Record<keyof TemplateBox, string>)[field]; }
