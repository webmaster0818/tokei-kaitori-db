#!/usr/bin/env node
// 掲載を終えた型番ページの 301 リダイレクト（out/_redirects）を生成する。next build と sitemap 生成の後に実行する。
//
// ■ なぜ要るか
//   型番ページは「2社以上の価格がそろっている型番」だけを公開するため、取得元の掲載終了や月替わりで
//   公開・非公開が日々入れ替わる。非公開になったページは 404 になり、検索エンジンの評価が失われる
//   （2026-10-02 に32ページ・10-15 に15ページが 404 化）。モデルのハブ（無ければブランド、無ければ TOP）へ 301 で送る。
//
// ■ 「過去に公開していた型番」の集め方
//   1) data/ever-published-refs.json（リポジトリに入れている記録）
//   2) git 履歴の public/sitemap.xml に1度でも載った /ref/ の URL（取得できる環境のみ）
//   3) 今回のビルドで公開している型番（out/ref/*/index.html）
//   ⚠️ Cloudflare Pages のビルドは浅い clone で git 履歴がほぼ無い。だから 1) を正とし、
//      ローカル（日次の daily-update.sh を含む）でビルドしたときに 1)〜3) の和集合を 1) に書き戻す
//      （daily-update.sh の git add -A でコミットされる）。
//
// ■ 安全策
//   - **いま公開している型番は絶対にリダイレクトしない**（毎回 out/ を見て再計算する。型番は復活し得る）。
//   - 転送先は out/ に実在するページだけ。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, "out");
const seedPath = path.join(root, "data", "ever-published-refs.json");
const isCi = !!(process.env.CF_PAGES || process.env.CI);

if (!fs.existsSync(path.join(outDir, "index.html"))) {
  console.error("🚨 out/ がありません。next build の後に実行してください。");
  process.exit(1);
}

const exists = (p) => fs.existsSync(path.join(outDir, p, "index.html"));

// 3) 今回公開している型番（ディレクトリ名＝小文字の URL スラッグ）
const refDir = path.join(outDir, "ref");
const published = new Set(
  fs.existsSync(refDir) ? fs.readdirSync(refDir).filter((d) => fs.existsSync(path.join(refDir, d, "index.html"))) : [],
);

// 1) 記録ファイル
const seed = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, "utf8")) : { refs: [] };
const ever = new Set((seed.refs ?? []).map((s) => s.toLowerCase()));
const seedBefore = ever.size;

// 2) git 履歴（取得できなければ黙って飛ばす）
let fromGit = 0;
try {
  const log = execFileSync("git", ["log", "-p", "--format=", "--", "public/sitemap.xml"], {
    cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
  });
  for (const m of log.matchAll(/<loc>[^<]*?\/ref\/([^/<]+)\/?<\/loc>/g)) {
    const slug = decodeURIComponent(m[1]).toLowerCase();
    if (!ever.has(slug)) fromGit++;
    ever.add(slug);
  }
} catch {
  console.log("git 履歴を読めないため、data/ever-published-refs.json のみを使います。");
}
for (const p of published) ever.add(p);

// 転送先の決定に使う型番マスタとモデル定義（lib/families.json は lib/models.ts と共有）
const master = JSON.parse(fs.readFileSync(path.join(root, "data", "watch-master.json"), "utf8")).refs ?? {};
const { families, brands } = JSON.parse(fs.readFileSync(path.join(root, "lib", "families.json"), "utf8"));
const bySlug = new Map(Object.keys(master).map((k) => [k.toLowerCase(), k]));

function familyOf(models) {
  const s = models.join(" ");
  let best = null, bestLen = 0;
  for (const f of families) for (const k of f.keys) if (s.includes(k) && k.length > bestLen) { best = f; bestLen = k.length; }
  return best;
}

function target(slug) {
  const ref = bySlug.get(slug);
  const m = ref ? master[ref] : null;
  if (m) {
    const f = familyOf(m.models ?? []);
    if (f && exists(`model/${f.slug}`)) return `/model/${f.slug}/`;
    const b = brands.find((x) => x.label === m.brand);
    if (b && exists(`brand/${b.slug}`)) return `/brand/${b.slug}/`;
  }
  return "/";
}

const lines = [];
const counts = { model: 0, brand: 0, top: 0 };
for (const slug of [...ever].sort()) {
  if (published.has(slug)) continue; // ⚠️ 公開中は絶対に転送しない
  // _redirects はスペース区切り。空白を含む型番は書けないので飛ばす（現状0件）
  if (/\s/.test(slug)) continue;
  const to = target(slug);
  counts[to.startsWith("/model/") ? "model" : to.startsWith("/brand/") ? "brand" : "top"]++;
  lines.push(`/ref/${slug}/ ${to} 301`);
  lines.push(`/ref/${slug} ${to} 301`);
}

const header = [
  "# 掲載を終えた型番ページの転送（scripts/generate-redirects.mjs がビルドごとに生成。手で編集しない）",
  `# 生成: ${new Date().toISOString()} / 過去に公開した型番 ${ever.size} / 公開中 ${published.size} / 転送 ${lines.length / 2}`,
];
fs.writeFileSync(path.join(outDir, "_redirects"), [...header, ...lines, ""].join("\n"));
// ⚠️ 2026-10-17: 本番（Cloudflare の Git 連携ビルド）で out/_redirects が効かなかった。
//    ビルドコマンドがこのスクリプトを通らない場合に備え、ローカルビルドでは public/_redirects にも書き、
//    next build が out/ へコピーする形でも届くようにする（日次の git add -A でコミットされる）。
if (!isCi) fs.writeFileSync(path.join(root, "public", "_redirects"), [...header, ...lines, ""].join("\n"));
console.log(
  `_redirects: 転送 ${lines.length / 2}型番（モデル ${counts.model} / ブランド ${counts.brand} / TOP ${counts.top}）` +
    ` / 過去に公開 ${ever.size}（記録 ${seedBefore}・git 追加 ${fromGit}）/ 公開中 ${published.size}`,
);

// 記録ファイルへの書き戻し（ローカルのビルドのみ。CF のビルドでは書いても捨てられる）
if (!isCi) {
  const refs = [...ever].sort();
  const prev = (seed.refs ?? []).map((s) => s.toLowerCase()).sort();
  if (refs.join("\n") !== prev.join("\n")) {
    const body = {
      note: "過去に /ref/<slug>/ として公開したことのある型番（URL のスラッグ・小文字）。scripts/generate-redirects.mjs がローカルのビルドで追記する。手で削除しない（掲載終了ページの 301 転送の根拠）。",
      updated: new Date().toISOString().slice(0, 10),
      count: refs.length,
      refs,
    };
    fs.writeFileSync(seedPath, JSON.stringify(body, null, 1) + "\n");
    console.log(`data/ever-published-refs.json を更新: ${prev.length} → ${refs.length}`);
  }
}
