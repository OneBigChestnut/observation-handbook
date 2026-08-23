import { useEffect, useState } from "react";
import type { TemplateSummary } from "../api/client.js";
export function TemplateManagementPage({ loadTemplates, retireTemplate }: { loadTemplates: () => Promise<TemplateSummary[]>; retireTemplate: (id: string) => Promise<void> }) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  useEffect(() => { void loadTemplates().then(setTemplates); }, [loadTemplates]);
  return <section aria-label="模板管理">{templates.map(template => <article key={template.id}><b>{template.name}</b><span>{template.kind} · A5 · 竖版 · {template.state}</span><button onClick={async () => { await retireTemplate(template.id); setTemplates(items => items.map(item => item.id === template.id ? { ...item, state: "retired" } : item)); }}>停用</button></article>)}</section>;
}
