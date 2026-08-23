import { useEffect, useState } from "react";
import { apiClient, type PublicationSummary } from "../api/client.js";
export function PublicHandbookReader({ id }: { id: string }) { const [item,setItem]=useState<PublicationSummary|null>(null);useEffect(()=>{void apiClient.publication(id).then(setItem);},[id]);return item?<article aria-label="公共手册阅读"><h2>{item.title}</h2><p>{item.introduction}</p><small>{item.childName} · {item.cardCount} 张卡片</small></article>:<p>正在加载…</p>; }
