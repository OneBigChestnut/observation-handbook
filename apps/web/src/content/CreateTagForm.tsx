import { useState } from "react";
import { apiClient } from "../api/client.js";

export function CreateTagForm({ childId, createTag = apiClient.createTag, onCreated }: { childId: string; createTag?: (childId: string, payload: { name: string; color: string }) => Promise<{ id: string }>; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  return <form className="export-dialog" onSubmit={async event => { event.preventDefault(); try { await createTag(childId, { name: name.trim(), color: "olive" }); setNotice("标签已创建。"); onCreated(); } catch { setNotice("创建失败，请检查标签名称。"); } }}><header><div><p>当前小朋友的观察档案</p><h2>新建标签</h2></div></header><label className="field-label">标签名称<input aria-label="标签名称" value={name} onChange={event => setName(event.target.value)} /></label><footer><button className="save-card" type="submit">创建标签</button>{notice && <span>{notice}</span>}</footer></form>;
}
