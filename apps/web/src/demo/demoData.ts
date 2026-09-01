import type { ExportSummary, HandbookSummary, ObservationCardSummary, TagSummary, TemplateLayout } from "../api/client.js";

export const DEMO_CHILD_ID = "demo-child-lele";
export const DEMO_FAMILY_ID = "demo-family";

const localDemoImages: Record<string, string> = {
  "photo-1523712999610-f77fbcfc3843": "/api/demo-media/park/thumbnails/001-44b9671d-2911-4a57-b017-aa40e1afe52b.jpg",
  "photo-1502082553048-f009c37129b9": "/api/demo-media/park/thumbnails/002-9fe3fc62-2f5c-4ed1-8657-95dfb98ef0f3.jpg",
  "photo-1433086966358-54859d0ed716": "/api/demo-media/river/thumbnails/001-6091d90f-5a99-4a85-bcab-7f24831ddf58.jpg",
  "photo-1559715541-5daf8a29f5a4": "/api/demo-media/river/thumbnails/002-5990278a-baed-40da-b224-f9ad4cb74275.jpg",
  "photo-1592841200221-a6898f307baa": "/api/demo-media/tomato/thumbnails/001-7b40f138-8317-4730-8018-15b1401fbc8d.jpg",
};
const image = (id: string, width = 720) => localDemoImages[id] ?? `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
const photo = (id: string) => ({ id: `demo-media-${id}`, thumbnailUrl: image(id, 520) });
const layouts: Record<1 | 2 | 3 | 4, TemplateLayout> = {
  1: { preset: "natural", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 9, width: 80, height: 55 }], texts: [{ id: "title", x: 10, y: 68, width: 80, height: 8, content: "我发现了什么？", color: "#1c5040", fontSize: 16 }], lines: [{ id: "rule", x: 10, y: 65, width: 80, color: "#987a44", thickness: 1 }] },
  2: { preset: "natural", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 9, width: 38, height: 55 }, { id: "photo-2", x: 52, y: 9, width: 38, height: 55 }], texts: [{ id: "title", x: 10, y: 70, width: 80, height: 10, content: "两张照片的对照", color: "#1c5040", fontSize: 15 }], lines: [] },
  3: { preset: "natural", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 9, width: 80, height: 31 }, { id: "photo-2", x: 10, y: 44, width: 38, height: 23 }, { id: "photo-3", x: 52, y: 44, width: 38, height: 23 }], texts: [{ id: "title", x: 10, y: 72, width: 80, height: 9, content: "变化记录", color: "#1c5040", fontSize: 15 }], lines: [{ id: "rule", x: 10, y: 69, width: 80, color: "#57806a", thickness: 1 }] },
  4: { preset: "natural", safeMarginMm: 10, textAlign: "left", photos: [{ id: "photo-1", x: 10, y: 9, width: 38, height: 28 }, { id: "photo-2", x: 52, y: 9, width: 38, height: 28 }, { id: "photo-3", x: 10, y: 41, width: 38, height: 28 }, { id: "photo-4", x: 52, y: 41, width: 38, height: 28 }], texts: [{ id: "title", x: 10, y: 73, width: 80, height: 9, content: "四格观察", color: "#1c5040", fontSize: 15 }], lines: [] },
};

const cardSeed: Array<{ id: string; date: string; text: string; tags: string[]; handbookId: string; photos: string[] }> = [
  { id: "demo-card-1", date: "2026-03-02", text: "玉兰开了第一朵，花瓣像一只白色的小勺子。", tags: ["公园", "季节"], handbookId: "demo-handbook-park", photos: ["photo-1523712999610-f77fbcfc3843"] },
  { id: "demo-card-2", date: "2026-04-16", text: "树叶缝里的绿色有七种，最深的那一种藏在树干旁边。", tags: ["公园"], handbookId: "demo-handbook-park", photos: ["photo-1502082553048-f009c37129b9", "photo-1523712999610-f77fbcfc3843"] },
  { id: "demo-card-3", date: "2026-05-26", text: "背阴的一面青苔颜色更深，摸起来像湿绒布。", tags: ["小河"], handbookId: "demo-handbook-river", photos: ["photo-1433086966358-54859d0ed716", "photo-1433086966358-54859d0ed716", "photo-1559715541-5daf8a29f5a4"] },
  { id: "demo-card-4", date: "2026-07-12", text: "站在桥上往下看，河水把云朵拉成了细线。", tags: ["小河", "天气"], handbookId: "demo-handbook-river", photos: ["photo-1433086966358-54859d0ed716", "photo-1559715541-5daf8a29f5a4", "photo-1523712999610-f77fbcfc3843", "photo-1433086966358-54859d0ed716"] },
  { id: "demo-card-5", date: "2026-05-01", text: "把番茄种子埋进土里，每天用尺子量它有没有长高。", tags: ["植物"], handbookId: "demo-handbook-tomato", photos: ["photo-1592841200221-a6898f307baa"] },
  { id: "demo-card-6", date: "2026-08-21", text: "再给小鸟看一天，再摘下第一颗变红的番茄。", tags: ["植物", "收获"], handbookId: "demo-handbook-tomato", photos: ["photo-1592841200221-a6898f307baa", "photo-1502082553048-f009c37129b9"] },
];

export const demoCards: ObservationCardSummary[] = cardSeed.map(card => ({ id: card.id, observedAt: card.date, createdAt: `${card.date}T09:00:00.000Z`, text: card.text, photos: card.photos.map(photo), tags: card.tags.map((name, index) => ({ id: `demo-tag-${name}`, name, color: ["forest", "ochre", "olive"][index % 3] })), templateId: `demo-template-card-${card.photos.length}`, templateKind: `card_${card.photos.length}` as ObservationCardSummary["templateKind"], templateLayout: layouts[Math.min(card.photos.length, 4) as 1 | 2 | 3 | 4], handbooks: [{ id: card.handbookId, title: card.handbookId === "demo-handbook-park" ? "公园的一年" : card.handbookId === "demo-handbook-river" ? "门口的小河" : "阳台的番茄" }] }));

export const demoHandbooks: HandbookSummary[] = [
  { id: "demo-handbook-park", title: "公园的一年", introduction: "从第一朵玉兰，到夏末长椅边的黄叶。", startedAt: "2026-03-02", completedAt: null, status: "ongoing", cardCount: 2, tagCount: 2, cardIds: ["demo-card-1", "demo-card-2"], tagIds: ["demo-tag-公园", "demo-tag-季节"] },
  { id: "demo-handbook-river", title: "门口的小河", introduction: "水位、石桥、鸭群和河水声音的日常消息。", startedAt: "2026-05-26", completedAt: null, status: "ongoing", cardCount: 2, tagCount: 2, cardIds: ["demo-card-3", "demo-card-4"], tagIds: ["demo-tag-小河", "demo-tag-天气"] },
  { id: "demo-handbook-tomato", title: "阳台的番茄", introduction: "一粒种子慢慢变成红色小果实。", startedAt: "2026-05-01", completedAt: "2026-08-21", status: "completed", cardCount: 2, tagCount: 2, cardIds: ["demo-card-5", "demo-card-6"], tagIds: ["demo-tag-植物", "demo-tag-收获"] },
];

export const demoTags: TagSummary[] = ["公园", "季节", "小河", "天气", "植物", "收获"].map((name, index) => ({ id: `demo-tag-${name}`, name, color: ["forest", "ochre", "olive", "blue", "rose", "slate"][index], cardCount: demoCards.filter(card => card.tags.some(tag => tag.name === name)).length }));
export const demoExports: ExportSummary[] = demoHandbooks.map((handbook, index) => ({ id: `demo-export-${handbook.id}`, childId: DEMO_CHILD_ID, handbookId: handbook.id, kind: index === 2 ? "print" : "screen", snapshot: JSON.stringify({ handbookId: handbook.id, cardIds: handbook.cardIds }), createdAt: `${handbook.completedAt ?? "2026-08-21"}T12:00:00.000Z` }));

export const demoImage = image;

type DemoManifestItem = { id: string; series: string; index: number; title: string; thumbnailPath: string; originalPath: string; creator: string; license: string };
type DemoArchive = { cards: ObservationCardSummary[]; handbooks: HandbookSummary[]; tags: TagSummary[]; exports: ExportSummary[] };
const seriesInfo: Record<string, { title: string; intro: string; tags: string[] }> = {
  park: { title: "公园的一年", intro: "从第一朵玉兰，到夏末长椅边的黄叶。", tags: ["公园", "季节"] },
  river: { title: "门口的小河", intro: "水位、石桥、鸭群和河水声音的日常消息。", tags: ["小河", "天气"] },
  tomato: { title: "阳台的番茄", intro: "一粒种子慢慢变成红色小果实。", tags: ["植物", "收获"] },
  "street-tree": { title: "一棵街边的树", intro: "在每天经过的路上，记录一棵树的细小变化。", tags: ["街道", "树木"] },
  "sky-weather": { title: "天空和天气", intro: "云、光、雨和晚霞组成的一本天空笔记。", tags: ["天空", "天气"] },
};
let demoArchivePromise: Promise<DemoArchive> | null = null;
async function loadDemoArchive(): Promise<DemoArchive> {
  if (!demoArchivePromise) demoArchivePromise = fetch("/api/demo-media/manifest").then(async response => {
    if (!response.ok) throw new Error("DEMO_MANIFEST_FAILED");
    const manifest = await response.json() as { items: DemoManifestItem[] };
    const cards: ObservationCardSummary[] = [];
    const handbooks: HandbookSummary[] = [];
    Object.entries(seriesInfo).forEach(([series, info], seriesIndex) => {
      const assets = manifest.items.filter(item => item.series === series).slice(0, 12);
      const handbookId = `demo-handbook-${series}`;
      const cardIds: string[] = [];
      assets.forEach((asset, index) => {
        const photoCount = (index % 4) + 1 as 1 | 2 | 3 | 4;
        const selectedAssets = assets.slice(index, index + photoCount);
        const cardId = `demo-${series}-${String(index + 1).padStart(2, "0")}`;
        cardIds.push(cardId);
        cards.push({ id: cardId, observedAt: `2026-${String(3 + ((seriesIndex + index) % 6)).padStart(2, "0")}-${String(2 + index).padStart(2, "0")}`, createdAt: `2026-08-${String(2 + index).padStart(2, "0")}T09:00:00.000Z`, text: `${asset.title}。这是${info.title}中的第 ${index + 1} 次观察，记录下今天看到的细节。`, photos: selectedAssets.map(item => ({ id: `demo-library-${item.series}-${item.index}`, thumbnailUrl: `/api/demo-media/${item.thumbnailPath}` })), tags: info.tags.map((name, tagIndex) => ({ id: `demo-tag-${name}`, name, color: ["forest", "ochre", "olive", "blue", "rose", "slate"][((seriesIndex + tagIndex) % 6)] })), templateId: `demo-template-card_${photoCount}-library`, templateKind: `card_${photoCount}`, templateLayout: layouts[photoCount], handbooks: [{ id: handbookId, title: info.title }] });
      });
      handbooks.push({ id: handbookId, title: info.title, introduction: info.intro, startedAt: "2026-03-02", completedAt: seriesIndex === 2 ? "2026-08-21" : null, status: seriesIndex === 2 ? "completed" : "ongoing", cardCount: cardIds.length, tagCount: info.tags.length, cardIds, tagIds: info.tags.map(name => `demo-tag-${name}`), coverPhotoId: cards.find(card => card.id === cardIds[0])?.photos[0]?.id ?? null, backPhotoId: cards.find(card => card.id === cardIds.at(-1))?.photos.at(-1)?.id ?? null });
    });
    const tags = Object.values(seriesInfo).flatMap(info => info.tags).filter((name, index, all) => all.indexOf(name) === index).map(name => ({ id: `demo-tag-${name}`, name, color: "forest", cardCount: cards.filter(card => card.tags.some(tag => tag.name === name)).length }));
    const exports = handbooks.map(handbook => ({ id: `demo-export-${handbook.id}`, childId: DEMO_CHILD_ID, handbookId: handbook.id, kind: handbook.status === "completed" ? "print" as const : "screen" as const, snapshot: JSON.stringify({ handbookId: handbook.id, cardIds: handbook.cardIds }), createdAt: "2026-08-21T12:00:00.000Z" }));
    return { cards, handbooks, tags, exports };
  }).catch(() => ({ cards: demoCards, handbooks: demoHandbooks, tags: demoTags, exports: demoExports }));
  return demoArchivePromise;
}
export const demoLoadCards = async (_childId: string) => (await loadDemoArchive()).cards;
export const demoLoadHandbooks = async (_childId: string) => (await loadDemoArchive()).handbooks;
export const demoLoadTags = async (_childId: string) => (await loadDemoArchive()).tags;
export const demoLoadExports = async (_childId: string) => (await loadDemoArchive()).exports;
