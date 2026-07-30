#!/usr/bin/env node
// out/sitemap.xml を生成。SITE_URL は環境変数 NEXT_PUBLIC_SITE_URL（ドメイン確定後に設定）
import fs from "node:fs";
import path from "node:path";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.invalid";
const root = process.cwd();
const refs = JSON.parse(fs.readFileSync(path.join(root, "data/prototype-refs.json"), "utf8"));
const dates = fs.readdirSync(path.join(root, "data/prices")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
const lastmod = dates[dates.length - 1];

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
