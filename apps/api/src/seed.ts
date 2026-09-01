import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "./db/client.js";
import { accounts, cardPhotos, cardTags, children, families, familyMemberships, handbookCards, handbooks, mediaAssets, observationCards, tags, templateUsages, templateVersions } from "./db/schema.js";
import { storeChildImage } from "./media/storage.js";
import { hashPassword } from "./password.js";

const developmentPassword = "correct-horse-battery-staple";
const familyId = "family-lin";
const defaultMediaDirectory = fileURLToPath(new URL("../data/media", import.meta.url));

export async function seedDevelopmentData(database: AppDatabase, mediaDirectory = defaultMediaDirectory): Promise<string> {
  const createdAt = new Date();
  const demoOwner = await ensureAccount(database, "account-lin", "lin", null);
  const reader = await ensureAccount(database, "account-zhou", "zhou", null);
  await ensureAccount(database, "account-platform", "platform", "super_admin");
  const family = await database.query.families.findFirst({ where: eq(families.id, familyId) });
  if (!family) await database.insert(families).values({ id: familyId, name: "林家观察册", createdAt });

  await database.insert(familyMemberships).values([{ accountId: demoOwner.id, familyId, role: "admin" }, { accountId: reader.id, familyId, role: "reader" }]).onConflictDoNothing();
  await database.insert(children).values([{ id: "child-lele", familyId, name: "乐乐", createdAt }, { id: "child-anan", familyId, name: "安安", createdAt }]).onConflictDoNothing();
  await database.update(handbooks).set({ coverTemplateId: null, backTemplateId: null, updatedAt: createdAt });
  await database.update(observationCards).set({ templateId: null, updatedAt: createdAt });
  await database.delete(templateUsages);
  await database.delete(templateVersions);
  await database.insert(templateVersions).values(templateSeedRows(createdAt));

  const media = await Promise.all([
    ensureDemoMedia(database, mediaDirectory, "demo-media-flowers", "child-lele", "park-flowers.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-forest", "child-lele", "park-forest.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-river", "child-lele", "river-path.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-tomato", "child-anan", "tomato-plant.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-sunlight", "child-lele", "park-sunlight.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-leaf", "child-lele", "garden-leaf.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-woodland", "child-lele", "woodland.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-autumn", "child-lele", "autumn-path.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-indoor-plant", "child-anan", "indoor-plant.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-garden-bed", "child-anan", "garden-bed.jpg"),
    ensureDemoMedia(database, mediaDirectory, "demo-media-window-flower", "child-anan", "window-flower.jpg"),
  ]);
  const mediaIds = Object.fromEntries(media.map(item => [item.id, item.id]));

  await database.insert(tags).values([
    { id: "demo-tag-season", childId: "child-lele", name: "季节", color: "ochre", createdAt }, { id: "demo-tag-river", childId: "child-lele", name: "小河", color: "blue", createdAt },
    { id: "demo-tag-park", childId: "child-lele", name: "公园", color: "olive", createdAt }, { id: "demo-tag-plant", childId: "child-anan", name: "植物", color: "green", createdAt },
    { id: "demo-tag-window", childId: "child-anan", name: "窗边", color: "rose", createdAt },
  ]).onConflictDoNothing();
  await database.insert(observationCards).values([
    { id: "demo-card-magnolia", childId: "child-lele", observedAt: "2026-03-02", text: "玉兰开了第一朵。乐乐说花瓣像一只白色的小勺子，想用它盛住春天。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-shade", childId: "child-lele", observedAt: "2026-05-12", text: "树影移动得很慢，乐乐把长椅上不同形状的光斑画了下来。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-park", childId: "child-lele", observedAt: "2026-08-18", text: "公园里的第一片黄叶落在长椅边。我们把它夹进书里，等秋天回来翻看。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-river", childId: "child-lele", observedAt: "2026-08-20", text: "门口的小河今天水位很高，有三只野鸭排成一队游过石桥。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-river-sound", childId: "child-lele", observedAt: "2026-08-22", text: "乐乐闭上眼睛听河水：快的时候像沙沙的纸，慢的时候像有人在轻轻倒水。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-park-sun", childId: "child-lele", observedAt: "2026-04-16", text: "太阳从树叶缝里落下来，乐乐数出长椅上有七种不一样的绿色。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-park-wind", childId: "child-lele", observedAt: "2026-06-04", text: "风来了，草地像一层会呼吸的毯子。乐乐趴下来听，听见了蚂蚁搬家的声音。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-park-autumn", childId: "child-lele", observedAt: "2026-10-08", text: "我们把三片叶子排成从黄到褐的颜色卡，给秋天取名叫“慢慢变深”。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-river-moss", childId: "child-lele", observedAt: "2026-05-26", text: "石头上的青苔摸起来像湿绒布。乐乐发现背阴的一面颜色更深。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-river-bridge", childId: "child-lele", observedAt: "2026-07-12", text: "站在桥上往下看，河水把云朵拉成了细细的线。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-river-ducks", childId: "child-lele", observedAt: "2026-08-26", text: "今天鸭群多了一只小鸭。乐乐画了一张“谁跟着谁游”的路线图。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-seed", childId: "child-anan", observedAt: "2026-05-01", text: "安安把番茄种子埋进土里，每天用尺子量它有没有长高。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-tomato", childId: "child-anan", observedAt: "2026-08-21", text: "阳台番茄终于变红了。安安没有立刻摘下，说要再给小鸟看一天。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-tomato-leaf", childId: "child-anan", observedAt: "2026-05-16", text: "第一片真叶展开了，安安说它像在对我们挥手。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-tomato-flower", childId: "child-anan", observedAt: "2026-06-19", text: "黄色小花开了三朵。我们用棉签轻轻帮它传花粉，像给植物寄信。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-tomato-taste", childId: "child-anan", observedAt: "2026-08-23", text: "第一颗番茄切开后有很多小籽。安安把最甜的一瓣留给了外婆。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-window-rain", childId: "child-anan", observedAt: "2026-03-18", text: "雨滴在玻璃上赛跑，安安用手指跟着最快的一颗走到窗台。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-window-bird", childId: "child-anan", observedAt: "2026-04-28", text: "窗外枝头来了两只小鸟。安安给它们画了圆圆的肚子和细细的脚。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-window-light", childId: "child-anan", observedAt: "2026-06-28", text: "下午四点，光会越过花盆停在地板上。我们量了它一天里最长的影子。", state: "active", createdAt, updatedAt: createdAt },
    { id: "demo-card-window-flower", childId: "child-anan", observedAt: "2026-08-10", text: "窗边的小花朝着亮处转。安安说，它也在认真看外面的世界。", state: "active", createdAt, updatedAt: createdAt },
  ]).onConflictDoNothing();
  await Promise.all([
    database.update(observationCards).set({ text: "公园里的第一片黄叶落在长椅边。我们把它夹进书里，等秋天回来翻看。", updatedAt: createdAt }).where(eq(observationCards.id, "demo-card-park")),
    database.update(observationCards).set({ text: "门口的小河今天水位很高，有三只野鸭排成一队游过石桥。", updatedAt: createdAt }).where(eq(observationCards.id, "demo-card-river")),
    database.update(observationCards).set({ text: "阳台番茄终于变红了。安安没有立刻摘下，说要再给小鸟看一天。", updatedAt: createdAt }).where(eq(observationCards.id, "demo-card-tomato")),
  ]);
  await database.insert(cardPhotos).values([
    { cardId: "demo-card-magnolia", mediaAssetId: mediaIds["demo-media-flowers"], position: 0 }, { cardId: "demo-card-shade", mediaAssetId: mediaIds["demo-media-forest"], position: 0 },
    { cardId: "demo-card-park", mediaAssetId: mediaIds["demo-media-forest"], position: 0 }, { cardId: "demo-card-river", mediaAssetId: mediaIds["demo-media-river"], position: 0 },
    { cardId: "demo-card-river-sound", mediaAssetId: mediaIds["demo-media-river"], position: 0 }, { cardId: "demo-card-seed", mediaAssetId: mediaIds["demo-media-tomato"], position: 0 },
    { cardId: "demo-card-tomato", mediaAssetId: mediaIds["demo-media-tomato"], position: 0 },
    { cardId: "demo-card-park-sun", mediaAssetId: mediaIds["demo-media-sunlight"], position: 0 }, { cardId: "demo-card-park-wind", mediaAssetId: mediaIds["demo-media-woodland"], position: 0 },
    { cardId: "demo-card-park-autumn", mediaAssetId: mediaIds["demo-media-autumn"], position: 0 }, { cardId: "demo-card-river-moss", mediaAssetId: mediaIds["demo-media-leaf"], position: 0 },
    { cardId: "demo-card-river-bridge", mediaAssetId: mediaIds["demo-media-river"], position: 0 }, { cardId: "demo-card-river-ducks", mediaAssetId: mediaIds["demo-media-sunlight"], position: 0 },
    { cardId: "demo-card-tomato-leaf", mediaAssetId: mediaIds["demo-media-indoor-plant"], position: 0 }, { cardId: "demo-card-tomato-flower", mediaAssetId: mediaIds["demo-media-garden-bed"], position: 0 },
    { cardId: "demo-card-tomato-taste", mediaAssetId: mediaIds["demo-media-tomato"], position: 0 }, { cardId: "demo-card-window-rain", mediaAssetId: mediaIds["demo-media-window-flower"], position: 0 },
    { cardId: "demo-card-window-bird", mediaAssetId: mediaIds["demo-media-garden-bed"], position: 0 }, { cardId: "demo-card-window-light", mediaAssetId: mediaIds["demo-media-indoor-plant"], position: 0 },
    { cardId: "demo-card-window-flower", mediaAssetId: mediaIds["demo-media-window-flower"], position: 0 },
  ]).onConflictDoNothing();
  await database.insert(cardTags).values([
    { cardId: "demo-card-magnolia", tagId: "demo-tag-season" }, { cardId: "demo-card-magnolia", tagId: "demo-tag-park" }, { cardId: "demo-card-shade", tagId: "demo-tag-park" },
    { cardId: "demo-card-park", tagId: "demo-tag-season" }, { cardId: "demo-card-park", tagId: "demo-tag-park" }, { cardId: "demo-card-river", tagId: "demo-tag-river" },
    { cardId: "demo-card-river-sound", tagId: "demo-tag-river" }, { cardId: "demo-card-seed", tagId: "demo-tag-plant" }, { cardId: "demo-card-tomato", tagId: "demo-tag-plant" },
    { cardId: "demo-card-park-sun", tagId: "demo-tag-park" }, { cardId: "demo-card-park-wind", tagId: "demo-tag-park" }, { cardId: "demo-card-park-autumn", tagId: "demo-tag-season" },
    { cardId: "demo-card-river-moss", tagId: "demo-tag-river" }, { cardId: "demo-card-river-bridge", tagId: "demo-tag-river" }, { cardId: "demo-card-river-ducks", tagId: "demo-tag-river" },
    { cardId: "demo-card-tomato-leaf", tagId: "demo-tag-plant" }, { cardId: "demo-card-tomato-flower", tagId: "demo-tag-plant" }, { cardId: "demo-card-tomato-taste", tagId: "demo-tag-plant" },
    { cardId: "demo-card-window-rain", tagId: "demo-tag-window" }, { cardId: "demo-card-window-bird", tagId: "demo-tag-window" }, { cardId: "demo-card-window-light", tagId: "demo-tag-window" }, { cardId: "demo-card-window-flower", tagId: "demo-tag-window" },
  ]).onConflictDoNothing();
  await database.insert(handbooks).values([
    { id: "demo-handbook-park", childId: "child-lele", title: "公园的一年", introduction: "从第一朵玉兰，到夏末落在长椅边的黄叶。", startedAt: "2026-03-02", completedAt: "2026-08-22", visibility: "family", createdAt, updatedAt: createdAt },
    { id: "demo-handbook-river", childId: "child-lele", title: "门口的小河", introduction: "水位、石桥、鸭群和河水声音的日常消息。", startedAt: "2026-04-12", completedAt: "2026-08-20", visibility: "family", createdAt, updatedAt: createdAt },
    { id: "demo-handbook-tomato", childId: "child-anan", title: "阳台的番茄", introduction: "一粒种子慢慢变成红色小果实。", startedAt: "2026-05-01", completedAt: null, visibility: "family", createdAt, updatedAt: createdAt },
    { id: "demo-handbook-window", childId: "child-anan", title: "窗台的一平方米", introduction: "在最熟悉的一扇窗前，收集雨滴、小鸟、光和花。", startedAt: "2026-03-18", completedAt: "2026-08-10", visibility: "family", createdAt, updatedAt: createdAt },
  ]).onConflictDoNothing();
  await database.update(handbooks).set({ coverTemplateId: "demo-template-cover-1", backTemplateId: "demo-template-back-1", updatedAt: createdAt }).where(inArray(handbooks.id, ["demo-handbook-park", "demo-handbook-river", "demo-handbook-tomato", "demo-handbook-window"]));
  await database.update(observationCards).set({ templateId: "demo-template-card_1-1", updatedAt: createdAt }).where(inArray(observationCards.id, ["demo-card-magnolia", "demo-card-shade", "demo-card-park", "demo-card-river", "demo-card-river-sound", "demo-card-park-sun", "demo-card-park-wind", "demo-card-park-autumn", "demo-card-river-moss", "demo-card-river-bridge", "demo-card-river-ducks", "demo-card-seed", "demo-card-tomato", "demo-card-tomato-leaf", "demo-card-tomato-flower", "demo-card-tomato-taste", "demo-card-window-rain", "demo-card-window-bird", "demo-card-window-light", "demo-card-window-flower"]));
  await Promise.all([
    database.update(handbooks).set({ introduction: "从第一朵玉兰，到夏末落在长椅边的黄叶。", updatedAt: createdAt }).where(eq(handbooks.id, "demo-handbook-park")),
    database.update(handbooks).set({ introduction: "水位、石桥、鸭群和河水声音的日常消息。", updatedAt: createdAt }).where(eq(handbooks.id, "demo-handbook-river")),
  ]);
  await database.delete(handbookCards).where(inArray(handbookCards.handbookId, ["demo-handbook-park", "demo-handbook-river", "demo-handbook-tomato", "demo-handbook-window"]));
  await database.insert(handbookCards).values([
    { handbookId: "demo-handbook-park", cardId: "demo-card-magnolia", position: 0 }, { handbookId: "demo-handbook-park", cardId: "demo-card-park-sun", position: 1 }, { handbookId: "demo-handbook-park", cardId: "demo-card-shade", position: 2 }, { handbookId: "demo-handbook-park", cardId: "demo-card-park-wind", position: 3 }, { handbookId: "demo-handbook-park", cardId: "demo-card-park", position: 4 }, { handbookId: "demo-handbook-park", cardId: "demo-card-park-autumn", position: 5 },
    { handbookId: "demo-handbook-river", cardId: "demo-card-river-moss", position: 0 }, { handbookId: "demo-handbook-river", cardId: "demo-card-river-bridge", position: 1 }, { handbookId: "demo-handbook-river", cardId: "demo-card-river", position: 2 }, { handbookId: "demo-handbook-river", cardId: "demo-card-river-sound", position: 3 }, { handbookId: "demo-handbook-river", cardId: "demo-card-river-ducks", position: 4 },
    { handbookId: "demo-handbook-tomato", cardId: "demo-card-seed", position: 0 }, { handbookId: "demo-handbook-tomato", cardId: "demo-card-tomato-leaf", position: 1 }, { handbookId: "demo-handbook-tomato", cardId: "demo-card-tomato-flower", position: 2 }, { handbookId: "demo-handbook-tomato", cardId: "demo-card-tomato", position: 3 }, { handbookId: "demo-handbook-tomato", cardId: "demo-card-tomato-taste", position: 4 },
    { handbookId: "demo-handbook-window", cardId: "demo-card-window-rain", position: 0 }, { handbookId: "demo-handbook-window", cardId: "demo-card-window-bird", position: 1 }, { handbookId: "demo-handbook-window", cardId: "demo-card-window-light", position: 2 }, { handbookId: "demo-handbook-window", cardId: "demo-card-window-flower", position: 3 },
  ]);
  return familyId;
}

async function ensureDemoMedia(database: AppDatabase, mediaDirectory: string, id: string, childId: string, filename: string) {
  const existing = await database.query.mediaAssets.findFirst({ where: eq(mediaAssets.id, id) });
  if (existing) return existing;
  const data = await readFile(fileURLToPath(new URL(`../data/demo-media/${filename}`, import.meta.url)));
  const stored = await storeChildImage({ id, mediaDirectory, mimeType: "image/jpeg", data });
  const media = { ...stored, childId, createdAt: new Date() };
  await database.insert(mediaAssets).values(media);
  return media;
}

function templateSeedRows(createdAt: Date) {
  const rows: { id: string; name: string; kind: "cover" | "back" | "card_1" | "card_2" | "card_3" | "card_4"; state: "published"; paperSize: "A5"; orientation: "portrait"; layout: string; createdAt: Date; updatedAt: Date }[] = [];
  const coverNames = ["四季标题页", "小小观察家", "自然档案", "我的发现"]; const coverStyles = ["center", "left", "center", "left"] as const;
  coverNames.forEach((name, index) => rows.push({ id: `demo-template-cover-${index + 1}`, name, kind: "cover", state: "published", paperSize: "A5", orientation: "portrait", layout: JSON.stringify(coverLayout(index, coverStyles[index])), createdAt, updatedAt: createdAt }));
  ["留白封底", "手写回望", "时间线封底", "给未来的我"].forEach((name, index) => rows.push({ id: `demo-template-back-${index + 1}`, name, kind: "back", state: "published", paperSize: "A5", orientation: "portrait", layout: JSON.stringify(backLayout(index)), createdAt, updatedAt: createdAt }));
  const cardNames: Record<"card_1" | "card_2" | "card_3" | "card_4", string[]> = { card_1: ["单图日记", "一眼发现", "照片小注", "今天的样子"], card_2: ["双图对照", "前后变化", "两处观察", "并排发现"], card_3: ["三图故事", "观察三幕", "连续记录", "细节拼图"], card_4: ["四图拼贴", "完整观察", "四格日常", "小小展览"] };
  (Object.keys(cardNames) as (keyof typeof cardNames)[]).forEach(kind => cardNames[kind].forEach((name, index) => rows.push({ id: `demo-template-${kind}-${index + 1}`, name, kind, state: "published", paperSize: "A5", orientation: "portrait", layout: JSON.stringify(cardLayout(kind, index)), createdAt, updatedAt: createdAt })));
  return rows;
}

function coverLayout(index: number, align: "center" | "left") {
  const x = align === "center" ? 14 : 10; const width = align === "center" ? 72 : 80;
  const photoUrls = ["/api/template-media/demo-media-forest/thumbnail", "/api/template-media/demo-media-river/thumbnail", "/api/template-media/demo-media-autumn/thumbnail", "/api/template-media/demo-media-flowers/thumbnail"];
  const photos = [[{ id: "cover-photo-1", x: 10, y: 8, width: 80, height: 47 }], [{ id: "cover-photo-1", x: 10, y: 8, width: 38, height: 47 }, { id: "cover-photo-2", x: 52, y: 8, width: 38, height: 47 }], [{ id: "cover-photo-1", x: 10, y: 8, width: 80, height: 27 }, { id: "cover-photo-2", x: 10, y: 39, width: 80, height: 16 }], [{ id: "cover-photo-1", x: 10, y: 8, width: 38, height: 26 }, { id: "cover-photo-2", x: 52, y: 8, width: 38, height: 26 }, { id: "cover-photo-3", x: 10, y: 38, width: 80, height: 17 }] ][index].map((photo, photoIndex) => ({ ...photo, imageUrl: photoUrls[(index + photoIndex) % photoUrls.length] }));
  return { preset: "natural" as const, safeMarginMm: 10 as const, textAlign: align, photos, texts: [{ id: "title", content: ["观察手册", "我的自然笔记", "一年的发现", "把世界记下来"][index], x, y: 59 + (index % 2) * 3, width, height: 10, fontSize: [26, 22, 24, 20][index], color: "#254c3c" as const }, { id: "maker", content: "制作人：________", x, y: 73, width, height: 7, fontSize: 11, color: "#57806a" as const }, { id: "time", content: "2026 · 观察记录", x, y: 82, width, height: 7, fontSize: 9, color: "#987a44" as const }], lines: [{ id: "rule", x, y: 69, width, color: "#987a44" as const, thickness: 1 }] };
}

function backLayout(index: number) {
  const photoUrls = ["/api/template-media/demo-media-river/thumbnail", "/api/template-media/demo-media-sunlight/thumbnail", "/api/template-media/demo-media-woodland/thumbnail", "/api/template-media/demo-media-leaf/thumbnail"];
  const photos = [[{ id: "back-photo-1", x: 10, y: 8, width: 80, height: 43 }], [{ id: "back-photo-1", x: 10, y: 8, width: 80, height: 22 }, { id: "back-photo-2", x: 10, y: 35, width: 38, height: 22 }, { id: "back-photo-3", x: 52, y: 35, width: 38, height: 22 }], [{ id: "back-photo-1", x: 10, y: 8, width: 38, height: 49 }, { id: "back-photo-2", x: 52, y: 8, width: 38, height: 23 }, { id: "back-photo-3", x: 52, y: 34, width: 38, height: 23 }], [{ id: "back-photo-1", x: 10, y: 8, width: 25, height: 49 }, { id: "back-photo-2", x: 38, y: 8, width: 25, height: 49 }, { id: "back-photo-3", x: 66, y: 8, width: 24, height: 49 }] ][index].map((photo, photoIndex) => ({ ...photo, imageUrl: photoUrls[(index + photoIndex) % photoUrls.length] }));
  return { preset: "natural" as const, safeMarginMm: 10 as const, textAlign: "left" as const, photos, texts: [{ id: "back-title", content: ["谢谢每一次发现", "观察还在继续", "留给下一次翻阅", "写给未来的我"][index], x: 12, y: 63, width: 76, height: 9, fontSize: [18, 16, 15, 14][index], color: "#254c3c" as const }, { id: "back-time", content: "观察手册 · 2026", x: 12, y: 78, width: 76, height: 7, fontSize: 10, color: "#987a44" as const }], lines: [{ id: "back-rule", x: 12, y: 59, width: 42 + index * 10, color: "#57806a" as const, thickness: 1 }] };
}

function cardLayout(kind: "card_1" | "card_2" | "card_3" | "card_4", index: number) {
  const layouts: Record<typeof kind, Array<Array<{ id: string; x: number; y: number; width: number; height: number }>>> = {
    card_1: [
      [{ id: "photo-1", x: 10, y: 8, width: 80, height: 55 }],
      [{ id: "photo-1", x: 10, y: 8, width: 56, height: 55 }],
      [{ id: "photo-1", x: 22, y: 8, width: 56, height: 42 }],
      [{ id: "photo-1", x: 10, y: 8, width: 80, height: 34 }],
    ],
    card_2: [
      [{ id: "photo-1", x: 10, y: 8, width: 38, height: 55 }, { id: "photo-2", x: 52, y: 8, width: 38, height: 55 }],
      [{ id: "photo-1", x: 10, y: 8, width: 80, height: 25 }, { id: "photo-2", x: 10, y: 38, width: 80, height: 25 }],
      [{ id: "photo-1", x: 10, y: 8, width: 54, height: 55 }, { id: "photo-2", x: 70, y: 8, width: 20, height: 55 }],
      [{ id: "photo-1", x: 10, y: 8, width: 38, height: 35 }, { id: "photo-2", x: 52, y: 8, width: 38, height: 22 }],
    ],
    card_3: [
      [{ id: "photo-1", x: 10, y: 8, width: 80, height: 28 }, { id: "photo-2", x: 10, y: 40, width: 38, height: 23 }, { id: "photo-3", x: 52, y: 40, width: 38, height: 23 }],
      [{ id: "photo-1", x: 10, y: 8, width: 24, height: 55 }, { id: "photo-2", x: 38, y: 8, width: 24, height: 55 }, { id: "photo-3", x: 66, y: 8, width: 24, height: 55 }],
      [{ id: "photo-1", x: 10, y: 8, width: 38, height: 24 }, { id: "photo-2", x: 52, y: 8, width: 38, height: 24 }, { id: "photo-3", x: 10, y: 37, width: 80, height: 26 }],
      [{ id: "photo-1", x: 10, y: 8, width: 36, height: 55 }, { id: "photo-2", x: 50, y: 8, width: 40, height: 24 }, { id: "photo-3", x: 50, y: 37, width: 40, height: 26 }],
    ],
    card_4: [
      [{ id: "photo-1", x: 10, y: 8, width: 38, height: 25 }, { id: "photo-2", x: 52, y: 8, width: 38, height: 25 }, { id: "photo-3", x: 10, y: 37, width: 38, height: 25 }, { id: "photo-4", x: 52, y: 37, width: 38, height: 25 }],
      [{ id: "photo-1", x: 10, y: 8, width: 80, height: 18 }, { id: "photo-2", x: 10, y: 31, width: 25, height: 32 }, { id: "photo-3", x: 42, y: 31, width: 25, height: 32 }, { id: "photo-4", x: 74, y: 31, width: 16, height: 32 }],
      [{ id: "photo-1", x: 10, y: 8, width: 48, height: 55 }, { id: "photo-2", x: 64, y: 8, width: 26, height: 16 }, { id: "photo-3", x: 64, y: 28, width: 26, height: 16 }, { id: "photo-4", x: 64, y: 48, width: 26, height: 15 }],
      [{ id: "photo-1", x: 10, y: 8, width: 80, height: 30 }, { id: "photo-2", x: 10, y: 43, width: 24, height: 20 }, { id: "photo-3", x: 38, y: 43, width: 24, height: 20 }, { id: "photo-4", x: 66, y: 43, width: 24, height: 20 }],
    ],
  };
  const photoUrls = ["/api/template-media/demo-media-forest/thumbnail", "/api/template-media/demo-media-river/thumbnail", "/api/template-media/demo-media-tomato/thumbnail", "/api/template-media/demo-media-sunlight/thumbnail", "/api/template-media/demo-media-autumn/thumbnail"];
  const photos = layouts[kind][index].map((photo, photoIndex) => ({ ...photo, imageUrl: photoUrls[(index + photoIndex + Number(kind.slice(-1))) % photoUrls.length] }));
  const titleY = [68, 68, 55, 68][index];
  const bodyY = titleY + 11;
  const titleContent = ["我看见了什么？", "今天的变化", "仔细看一看", "我的小结"][index];
  return { preset: "natural" as const, safeMarginMm: 10 as const, textAlign: "left" as const, photos, texts: [{ id: "title", content: titleContent, x: 10, y: titleY, width: 80, height: 9, fontSize: [16, 18, 15, 17][index], color: ["#254c3c", "#987a44", "#254c3c", "#57806a"][index] as "#254c3c" }, { id: "body", content: "写下你看到的变化、细节和猜想。", x: 10, y: bodyY, width: 80, height: 12, fontSize: [11, 10, 12, 11][index], color: "#57806a" as const }], lines: [{ id: "rule", x: [10, 18, 10, 26][index], y: titleY - 3, width: [80, 64, 80, 54][index], color: ["#987a44", "#57806a", "#987a44", "#254c3c"][index] as "#987a44", thickness: [1, 2, 1, 1][index] }] };
}

async function ensureAccount(database: AppDatabase, id: string, username: string, platformRole: "super_admin" | null) {
  const existing = await database.query.accounts.findFirst({ where: eq(accounts.username, username) });
  if (existing) {
    if (existing.platformRole !== platformRole) await database.update(accounts).set({ platformRole }).where(eq(accounts.id, existing.id));
    return { ...existing, platformRole };
  }
  const account = { id, username, passwordHash: await hashPassword(developmentPassword), platformRole, createdAt: new Date() };
  await database.insert(accounts).values(account);
  return account;
}
