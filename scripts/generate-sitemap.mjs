#!/usr/bin/env node
// out/sitemap.xml（と public/sitemap.xml）を生成する。next build の後に実行する。
//
// ■ 2026-10-17 フェーズ1で作り直し
//   以前は lib/prices.ts の公開条件をこのファイルに書き写して型番・ハブを数えていたが、
//   書き写しは片方だけ直す事故の元（2026-09-01・10-02 に sitemap と実ページが食い違った）。
//   いまは **out/ に実際に生成されたページ（index.html）をそのまま列挙する**。
//   これで sitemap とページは構造的に一致する（/ranking/・/shop/* など新しいページも自動で入る）。
// ■ <lastmod>
//   型番ページ = その型番の最新取得日（out/data/refs.json の latest_date）。
//   それ以外（TOP・ハブ・ランキング・買取店）= データ全体の最新取得日。
//
// ⚠️ daily-update.sh は build の後にこのスクリプトを単体でもう一度実行する。out/ を読むだけなので何度実行しても同じ結果になる。
import fs from "node:fs";
import path from "node:path";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://brandwatchbank.com";
const root = process.cwd();
const outDir = path.join(root, "out");
const dates = fs.readdirSync(path.join(root, "data/prices")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
const latest = dates[dates.length - 1];

const refsJsonPath = path.join(outDir, "data", "refs.json");
if (!fs.existsSync(refsJsonPath)) {
  console.error("🚨 out/data/refs.json がありません。next build の後に実行してください。sitemap は更新しません。");
  process.exit(1);
}
const refsJson = JSON.parse(fs.readFileSync(refsJsonPath, "utf8"));
const refLastmod = new Map(refsJson.refs.map((r) => [new URL(r.url).pathname, r.latest_date]));

// out/ の index.html を列挙（エラーページは除く）
const EXCLUDE = new Set(["/_not-found/", "/404/"]);
const pages = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith("_next")) continue;
    const d = path.join(dir, e.name);
    if (fs.existsSync(path.join(d, "index.html"))) pages.push("/" + path.relative(outDir, d).split(path.sep).join("/") + "/");
    walk(d);
  }
};
pages.push("/");
walk(outDir);

const rank = (p) => (p === "/" ? 0 : p.startsWith("/brand/") ? 1 : p.startsWith("/model/") ? 2 : p === "/ranking/" ? 3 : p.startsWith("/shop/") ? 4 : p.startsWith("/ref/") ? 6 : 5);
const urls = pages.filter((p) => !EXCLUDE.has(p)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

// 型番ページは refs.json と一致していなければならない（不一致はビルドの異常として止める）
const refPages = urls.filter((p) => p.startsWith("/ref/"));
const missing = refPages.filter((p) => !refLastmod.has(p));
const extra = [...refLastmod.keys()].filter((p) => !refPages.includes(p));
if (missing.length || extra.length) {
  console.error(`🚨 型番ページと refs.json が一致しません（ページのみ ${missing.length} / refs.json のみ ${extra.length}）`, missing.slice(0, 5), extra.slice(0, 5));
  process.exit(1);
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${refLastmod.get(p) ?? latest}</lastmod><changefreq>daily</changefreq></url>`),
  "</urlset>",
  "",
].join("\n");

for (const dir of ["public", "out"]) {
  const d = path.join(root, dir);
  if (fs.existsSync(d)) fs.writeFileSync(path.join(d, "sitemap.xml"), xml);
}
console.log(`sitemap: ${urls.length} URLs (型番 ${refPages.length} / lastmod 最新=${latest}, site=${SITE})`);

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
  const has = (p) => fs.existsSync(path.join(outDir, p, "index.html"));
  let files = 0, fixed = 0;
  const walkHtml = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walkHtml(f);
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
  walkHtml(outDir);
  console.log(`内部リンクの末尾スラッシュを補正: ${fixed}本 / ${files}ファイル`);
}
