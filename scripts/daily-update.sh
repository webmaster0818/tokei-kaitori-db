#!/bin/bash
# 時計買取DB 日次更新: 価格取得 → ビルド → sitemap。ドメイン確定後にデプロイ処理を追加する。
set -uo pipefail
SRC="/Users/takashi.hasegawa/projects/tokei-kaitori-db"
LOG="/tmp/tokei-daily.log"
export PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/local/bin:$PATH

say() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
cd "$SRC" || exit 1

say "=== 日次更新開始 ==="
if ! python3 scripts/fetch-watch-prices.py >>"$LOG" 2>&1; then
  say "🚨 価格取得に失敗（既存データは保持されます）"
  exit 1
fi
say "価格取得OK"

if ! NODE_OPTIONS=--max-old-space-size=4096 npm run build >>"$LOG" 2>&1; then
  say "🚨 ビルド失敗 → デプロイ中止"
  exit 1
fi
node scripts/generate-sitemap.mjs >>"$LOG" 2>&1
say "ビルド+sitemap OK"

# 変更をコミット（データの履歴を残す）
git add -A >>"$LOG" 2>&1
if git diff --cached --quiet; then
  say "データ変更なし"
else
  git commit -q -m "daily: 買取価格スナップショット $(date '+%F')" >>"$LOG" 2>&1 && say "コミット完了"
fi

# TODO(ドメイン確定後): out/ を deploy リポジトリへ rsync → push（CF Pages）
say "=== 完了 ==="
