import { useEffect, useState } from "react";
import { apiClient, type PublicationSummary } from "../api/client.js";
export function PublicHandbookList({ onOpen }: { onOpen: (id: string) => void }) { const [items,setItems]=useState<PublicationSummary[]>([]); useEffect(()=>{void apiClient.publications().then(setItems);},[]); return <section aria-label="公共观察档案">{items.map(item=><article key={item.id}><h2>{item.title}</h2><p>{item.introduction}</p><button onClick={()=>onOpen(item.id)}>阅读</button></article>)}</section>; }
