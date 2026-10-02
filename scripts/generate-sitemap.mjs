#!/usr/bin/env node
// out/sitemap.xml を生成。SITE_URL は環境変数 NEXT_PUBLIC_SITE_URL（ドメイン確定後に設定）
import fs from "node:fs";
import path from "node:path";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://brandwatchbank.com";
const root = process.cwd();
const dates = fs.readdirSync(path.join(root, "data/prices")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
const lastmod = dates[dates.length - 1];

// 実際に生成されるページと一致させる。以前は prototype-refs.json（10件）を見ていたため、
// 66ページ公開しているのに sitemap は 11 URL のままだった。
// lib/prices.ts の publishableRefs() と同じ条件（当月に2社以上の価格がある型番）で揃える。
const master = JSON.parse(fs.readFileSync(path.join(root, "data/watch-master.json"), "utf8")).refs ?? {};
const snapshot = JSON.parse(fs.readFileSync(path.join(root, `data/prices/${lastmod}.json`), "utf8")).records ?? [];
// ⚠️ 暦の当月ではなく「データに実在する最新の月」を使う。
// なんぼやは月次公開なので毎月1日は当月データが無く、暦で絞ると
// なんぼやのレコードが丸ごと落ちて sitemap が 190→61 に激減する（2026-09-01に発生）。
// lib/prices.ts の latestPriceMonth() と同じ考え方に揃える。
const months = snapshot.map((r) => r.price_month).filter(Boolean);
const month = months.length ? months.reduce((a, b) => (a > b ? a : b)) : lastmod.slice(0, 7);
// ⚠️ さらに「最新月だけ」も不可。なんぼやが今月の一覧から落とした型番のページが
//    毎月まとめて消える（2026-10-01に32ページが404化・うち20ページは検索表示があった）。
//    月次公開の店は「型番ごとに持っている中で最も新しい月」を採る。
//    lib/prices.ts の currentRecords() と同じ基準。片方だけ直すと sitemap と実ページが食い違う。
const STALE_MONTHS = 3;
const [fy, fm] = month.split("-").map(Number);
const fd = new Date(Date.UTC(fy, fm - 1 - STALE_MONTHS, 1));
const floor = `${fd.getUTCFullYear()}-${String(fd.getUTCMonth() + 1).padStart(2, "0")}`;
const newestByRefShop = new Map();
for (const r of snapshot) {
  if (!r.price_month || r.price_month < floor) continue;
  const k = `${r.ref}\u0000${r.shop}`;
  const cur = newestByRefShop.get(k);
  if (!cur || r.price_month > cur) newestByRefShop.set(k, r.price_month);
}
const shopsByRef = new Map();
for (const r of snapshot) {
  if (r.price_month && newestByRefShop.get(`${r.ref}\u0000${r.shop}`) !== r.price_month) continue;
  if (!shopsByRef.has(r.ref)) shopsByRef.set(r.ref, new Set());
  shopsByRef.get(r.ref).add(r.shop);
}
const refs = Object.keys(master).filter((ref) => (shopsByRef.get(ref)?.size ?? 0) >= 2);

// モデル/ブランドのハブも載せる。
// ⚠️ 判定は lib/models.ts と同じ「最長一致」にする。先頭一致だと
//    「スピードマスター デイデイト」(オメガ) が デイデイト(ロレックス) に入る。
const FAMILIES = [
  ["daytona", "ロレックス", ["デイトナ"]],
  ["submariner", "ロレックス", ["サブマリーナ"]],
  ["gmt-master-2", "ロレックス", ["GMTマスター II", "GMTマスターII", "GMT マスター II"]],
  ["gmt-master", "ロレックス", ["GMTマスター", "GMT マスター"]],
  ["datejust", "ロレックス", ["デイトジャスト"]],
  ["day-date", "ロレックス", ["デイデイト"]],
  ["explorer", "ロレックス", ["エクスプローラー"]],
  ["yacht-master", "ロレックス", ["ヨットマスター"]],
  ["sea-dweller", "ロレックス", ["シードゥエラー", "シードウェラー"]],
  ["sky-dweller", "ロレックス", ["スカイドゥエラー"]],
  ["milgauss", "ロレックス", ["ミルガウス"]],
  ["air-king", "ロレックス", ["エアキング"]],
  ["oyster-perpetual", "ロレックス", ["オイスターパーペチュアル"]],
  ["cellini", "ロレックス", ["チェリーニ"]],
  ["royal-oak", "オーデマ・ピゲ", ["ロイヤルオーク"]],
  ["speedmaster", "オメガ", ["スピードマスター"]],
  ["seamaster", "オメガ", ["シーマスター"]],
  ["constellation", "オメガ", ["コンステレーション"]],
  ["de-ville", "オメガ", ["デ・ヴィル", "デビル"]],
  ["overseas", "ヴァシュロン・コンスタンタン", ["オーヴァーシーズ", "オーバーシーズ"]],
  ["santos", "カルティエ", ["サントス"]],
  ["tank", "カルティエ", ["タンク"]],
  ["ballon-bleu", "カルティエ", ["バロンブルー"]],
];
const BRANDS = [["rolex","ロレックス"],["omega","オメガ"],["audemars-piguet","オーデマ・ピゲ"],
                ["vacheron-constantin","ヴァシュロン・コンスタンタン"],["cartier","カルティエ"]];
const famCount = {}, brandCount = {};
for (const ref of refs) {
  const text = (master[ref]?.models ?? []).join(" ");
  let best = null, bestLen = 0;
  for (const [slug, , keys] of FAMILIES)
    for (const k of keys)
      if (text.includes(k) && k.length > bestLen) { best = slug; bestLen = k.length; }
  if (best) famCount[best] = (famCount[best] ?? 0) + 1;
  const b = BRANDS.find(([, label]) => label === master[ref]?.brand);
  if (b) brandCount[b[0]] = (brandCount[b[0]] ?? 0) + 1;
}
// ⚠️ 型番が2件未満の家族/ブランドはページを作っていないので sitemap にも載せない
const modelUrls = Object.entries(famCount).filter(([, n]) => n >= 2).map(([slug]) => `${SITE}/model/${slug}/`);
const brandUrls = Object.entries(brandCount).filter(([, n]) => n >= 2).map(([slug]) => `${SITE}/brand/${slug}/`);

const urls = [`${SITE}/`, ...brandUrls, ...modelUrls, ...refs.map((r) => `${SITE}/ref/${r.toLowerCase()}/`)];
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>`),
  "</urlset>",
  "",
].join("\n");

for (const dir of ["public", "out"]) {
  const d = path.join(root, dir);
  if (fs.existsSync(d)) fs.writeFileSync(path.join(d, "sitemap.xml"), xml);
}
console.log(`sitemap: ${urls.length} URLs (lastmod=${lastmod}, site=${SITE})`);

/*
  🚨 内部リンクの末尾スラッシュを補う（2026-09-29）

  `trailingSlash: true` でも、**型番にドットが含まれると Next が拡張子と見なして
  <Link> の末尾スラッシュを落とす**（例: /ref/311.30.42.30.01.005）。
  結果、内部リンク1,521本のうち578本が末尾スラッシュ無しで出力され、
  クリックのたびに Cloudflare の 308 リダイレクトを1回挟んでいた。

  ビルド後に、実在するディレクトリを指す href だけスラッシュを補う。
  （存在しないパスには触らない＝リンク切れを作らない）
*/
{
  const outDir = path.join(root, "out");
  const has = (p) => fs.existsSync(path.join(outDir, p, "index.html"));
  let files = 0, fixed = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith(".html")) {
        const src = fs.readFileSync(f, "utf8");
        let n = 0;
        const out = src.replace(/href="(\/[^"?#]*[^/"])"/g, (m, p1) => {
          if (p1.startsWith("/_next") || !has(p1.replace(/^\//, ""))) return m;
          n++; return `href="${p1}/"`;
        });
        if (n) { fs.writeFileSync(f, out); fixed += n; }
        files++;
      }
    }
  };
  if (fs.existsSync(outDir)) {
    walk(outDir);
    console.log(`内部リンクの末尾スラッシュを補正: ${fixed}本 / ${files}ファイル`);
  }
}
