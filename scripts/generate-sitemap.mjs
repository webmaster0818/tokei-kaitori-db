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
const shopsByRef = new Map();
for (const r of snapshot) {
  if (r.price_month && r.price_month !== month) continue;
  if (!shopsByRef.has(r.ref)) shopsByRef.set(r.ref, new Set());
  shopsByRef.get(r.ref).add(r.shop);
}
const refs = Object.keys(master).filter((ref) => (shopsByRef.get(ref)?.size ?? 0) >= 2);

const urls = [`${SITE}/`, ...refs.map((r) => `${SITE}/ref/${r.toLowerCase()}/`)];
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
