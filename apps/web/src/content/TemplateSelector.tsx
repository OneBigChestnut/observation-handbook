import { useEffect, useState } from "react";

export type PublishedTemplate = { id: string; name: string; kind: "cover" | "back" | "card_1" | "card_2" | "card_3" | "card_4"; state: "published" };
export function TemplateSelector({ kind, loadTemplates, value, onChange }: { kind: PublishedTemplate["kind"]; loadTemplates: (kind: PublishedTemplate["kind"]) => Promise<PublishedTemplate[]>; value?: string; onChange?: (id: string) => void }) {
  const [templates, setTemplates] = useState<PublishedTemplate[]>([]);
  useEffect(() => { void loadTemplates(kind).then(setTemplates); }, [kind, loadTemplates]);
  return <label>版式<select aria-label="选择版式" value={value ?? ""} onChange={event => onChange?.(event.target.value)}><option value="">选择已发布版式</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>;
}
