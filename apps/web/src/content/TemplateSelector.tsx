import { useEffect, useState } from "react";

export type PublishedTemplate = { id: string; name: string; kind: "cover" | "back" | "card_1" | "card_2" | "card_3" | "card_4"; state: "published" | "draft" | "retired" };
export function TemplateSelector({ kind, loadTemplates, value, onChange, label = "选择版式" }: { kind: PublishedTemplate["kind"]; loadTemplates: (kind: PublishedTemplate["kind"]) => Promise<PublishedTemplate[]>; value?: string; onChange?: (id: string) => void; label?: string }) {
  const [templates, setTemplates] = useState<PublishedTemplate[]>([]);
  useEffect(() => { void loadTemplates(kind).then(setTemplates); }, [kind, loadTemplates]);
  return <label>{label}<select aria-label={label} value={value ?? ""} onChange={event => onChange?.(event.target.value)}><option value="">选择已发布版式</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>;
}
