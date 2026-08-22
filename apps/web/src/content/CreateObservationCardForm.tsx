import { useState } from "react";
import { apiClient } from "../api/client.js";

type CreateObservationCardFormProps = {
  childId: string;
  uploadMedia?: (childId: string, file: File) => Promise<{ id: string }>;
  createCard?: (childId: string, payload: { observedAt: string; text: string; mediaAssetIds: string[]; tagNames: string[] }) => Promise<{ id: string }>;
  onCreated: () => void;
};

export function CreateObservationCardForm({ childId, uploadMedia = apiClient.uploadMedia, createCard = apiClient.createCard, onCreated }: CreateObservationCardFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [tagText, setTagText] = useState("");
  const [notice, setNotice] = useState("");

  return <form className="card-composer" onSubmit={async event => { event.preventDefault(); if (files.length < 1 || files.length > 4) { setNotice("请选择 1–4 张照片。"); return; } try { setNotice("正在上传照片…"); const media = await Promise.all(files.map(file => uploadMedia(childId, file))); await createCard(childId, { observedAt: new Date().toISOString().slice(0, 10), text: text.trim(), mediaAssetIds: media.map(item => item.id), tagNames: [...new Set(tagText.split(",").map(tag => tag.trim()).filter(Boolean))] }); setNotice("记录已保存。"); onCreated(); } catch { setNotice("保存失败，请稍后重试。"); } }}><header><div><p>为当前小朋友新建</p><h2>观察卡片</h2></div></header><label className="field-label">选择照片<input aria-label="选择照片" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setFiles(Array.from(event.currentTarget.files ?? []).slice(0, 4))} /></label><label className="field-label">写下发现<textarea aria-label="写下发现" value={text} onChange={event => setText(event.target.value)} rows={4} /></label><label className="field-label">标签<input aria-label="标签" value={tagText} onChange={event => setTagText(event.target.value)} placeholder="用英文逗号分隔，例如：银杏, 夏末" /></label><footer><button className="save-card" type="submit">保存记录</button>{notice && <span>{notice}</span>}</footer></form>;
}
