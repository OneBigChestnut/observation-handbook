import { useState } from "react";
import type { HandbookSummary } from "../api/client.js";
export function ExportHandbookDialog({ childId, handbooks, createExport, onCreated }: { childId: string; handbooks: HandbookSummary[]; createExport: (childId: string, payload: { handbookId: string; kind: "screen" | "print" }) => Promise<unknown>; onCreated: () => void }) {
  const [handbookId, setHandbookId] = useState(handbooks[0]?.id ?? ""); const [kind, setKind] = useState<"screen" | "print">("screen");
  return <form aria-label="导出手册" onSubmit={async event => { event.preventDefault(); await createExport(childId, { handbookId, kind }); onCreated(); }}><label>观察手册<select aria-label="观察手册" value={handbookId} onChange={e => setHandbookId(e.target.value)}>{handbooks.map(h => <option value={h.id} key={h.id}>{h.title}</option>)}</select></label><label><input type="radio" checked={kind === "screen"} onChange={() => setKind("screen")} />屏幕 PDF</label><label><input type="radio" checked={kind === "print"} onChange={() => setKind("print")} />印刷 PDF（3mm 出血）</label><button type="submit">确认生成</button></form>;
}
