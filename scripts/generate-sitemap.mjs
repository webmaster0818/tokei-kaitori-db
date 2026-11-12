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
import crypto from "node:crypto";
import { execSync } from "node:child_process";

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

// ■ 2026-11-12 lastmod を「表示している値・本文が変わった日」に変更
//   以前は 型番＝最新取得日／それ以外＝データ全体の最新取得日 で、毎日 530 本すべてが同じ日付になっていた
//   （値が変わったかとは無関係＝Google が lastmod を当てにしなくなる）。
//   いまはページごとに「表示内容の指紋」を data/sitemap-lastmod.json に保存し、指紋が前回と変わった日だけ lastmod を進める。
//   - 型番ページ: refs.json の表示値（最高額・最低額・差額・最高額の店・社数・店の並び・定価）＋ページ上の各社の最新価格
//   - それ以外（TOP・ハブ・ランキング・買取店・ガイド・FAQ・用語集）: <main> の本文から日付の文字列を除いたもの
//   ⚠️ daily-update.sh は build 内と単体の2回このスクリプトを走らせる。2回目は指紋が一致するので結果は同じ（冪等）。
//   ⚠️ data/sitemap-lastmod.json は日次ジョブの git add -A でスナップショットと一緒にコミットされる。
//   初回（ファイルが無いとき）だけ、型番は data/history の価格が最後に変わった日、本文ページは content/*.md の最終コミット日で埋める。
const STATE_PATH = path.join(root, "data", "sitemap-lastmod.json");
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
const DATE_RE = /\d{4}-\d{2}-\d{2}|\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}|\d{1,2}\/\d{1,2}/g;
const mainText = (p) => {
  const h = fs.readFileSync(path.join(outDir, p, "index.html"), "utf8");
  const m = h.match(/<main[\s\S]*?<\/main>/);
  return (m ? m[0] : h)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ");
};
const refByPath = new Map(refsJson.refs.map((r) => [new URL(r.url).pathname, r]));
const fingerprint = (p) => {
  const r = refByPath.get(p);
  if (r) {
    const { latest_date, url, model_url, brand_url, ...shown } = r;
    const shopPrices = [...new Set([...mainText(p).matchAll(/([^\s:：]+（[^）]+）) \d{4}-\d{2}-\d{2}: ([\d,]+)円/g)].map((m) => `${m[1]}=${m[2]}`))].sort();
    return sha1(JSON.stringify(shown) + "|" + shopPrices.join(","));
  }
  return sha1(mainText(p).replace(DATE_RE, "").replace(/\s+/g, ""));
};

// 初回の埋め込み用
const gitDate = (rel) => {
  try {
    return execSync(`git log -1 --format=%cs -- "${rel}"`, { cwd: root, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};
const historyChangeDate = (ref) => {
  const f = path.join(root, "data", "history", `${ref}.json`);
  if (!fs.existsSync(f)) return null;
  const days = JSON.parse(fs.readFileSync(f, "utf8")).days ?? [];
  let prev = null, changed = null;
  for (const d of days) {
    const best = {};
    for (const x of d.records ?? []) {
      const k = `${x.shop}/${x.price_type}`;
      if (!(k in best) || x.price_jpy > best[k]) best[k] = x.price_jpy;
    }
    const sig = JSON.stringify(Object.entries(best).sort());
    if (sig !== prev) changed = d.date;
    prev = sig;
  }
  return changed;
};
const seedDate = (p) => {
  const r = refByPath.get(p);
  if (r) return historyChangeDate(r.ref) ?? latest;
  const m = p.match(/^\/(guide|brand|model|shop)\/([^/]+)\/$/);
  const dir = { guide: "guides", brand: "brands", model: "models", shop: "shops" };
  if (m && m[1] !== "shop" && fs.existsSync(path.join(root, "content", dir[m[1]], `${m[2]}.md`))) {
    const md = gitDate(`content/${dir[m[1]]}/${m[2]}.md`);
    if (m[1] === "guide") return md ?? latest;
    // ブランド・モデルは価格も表示する＝本文の更新日と、含む型番の値が変わった日の新しい方
    const key = m[1] === "brand" ? "brand_url" : "model_url";
    const refDates = refsJson.refs.filter((x) => x[key] && new URL(x[key]).pathname === p).map((x) => historyChangeDate(x.ref) ?? latest);
    return [md, ...refDates].filter(Boolean).sort().pop() ?? latest;
  }
  if (p === "/faq/" || p === "/glossary/") return gitDate(`content${p.slice(0, -1)}.md`) ?? latest;
  if (p === "/guide/") return gitDate("content/guides") ?? latest;
  return latest; // TOP・ランキング・買取店ページは全体（その店）の価格を表示する
};

const prevState = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8")).pages ?? {} : null;
const state = {};
let changedCount = 0;
for (const p of urls) {
  const h = fingerprint(p);
  const prev = prevState?.[p];
  if (prevState === null) state[p] = { h, d: seedDate(p) };
  else if (prev && prev.h === h) state[p] = prev;
  else { state[p] = { h, d: latest }; changedCount++; }
}
fs.writeFileSync(
  STATE_PATH,
  JSON.stringify({ _note: "sitemap の lastmod の元（scripts/generate-sitemap.mjs が更新。h=表示内容の指紋 d=それが変わった日）", pages: state }, null, 1) + "\n",
);
console.log(`lastmod: ${prevState === null ? "初回の埋め込み" : `表示内容が変わったページ ${changedCount}本`}・最新=${latest}・異なる日付 ${new Set(Object.values(state).map((x) => x.d)).size}種`);

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${state[p].d}</lastmod><changefreq>daily</changefreq></url>`),
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
