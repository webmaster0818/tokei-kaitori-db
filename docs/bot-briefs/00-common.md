# brandwatchbank 拡張プロジェクト — 全bot共通ルール（指揮: tomomi-2 / 依頼: MediaXAI 2026-10-17）

目標: 日本最大級の時計（買取価格）DBサイト。4本柱＝テクニカルSEO／コンテンツ拡充／内部リンク／演出。

## リポジトリと作業方法（厳守）
- リポ: https://github.com/webmaster0818/tokei-kaitori-db （Public）。HTTPS でクローンし、push は配布済みの webmaster0818 トークンで。
- **main へ push しない。** main への push＝即本番（Cloudflare が自動ビルド）。必ずブランチ `bot/<bot名>/<作業名>` に push し、tomomi-2 がレビューしてから main に入れる。
- **触ってよいのは自分の担当ディレクトリだけ**（各指示書に記載）。`app/` `components/` `lib/` `data/prices/` `data/history/` `scripts/daily-update.sh` `scripts/fetch-watch-prices.py` `public/` は変更禁止（tomomi-2 担当。毎日 11:25 に価格の自動更新が走る）。
- wrangler でのデプロイ禁止（本番は別アカウントの同名プロジェクト。誤配信になる）。

## 書き方・事実の基準
- `~/.openclaw/workspace/writing-standards.md`（v2）が最上位ルール。一次情報のみ・架空禁止・結論ファースト。
- サイト掲載文はビジネス文書の日本語（「当サイトでは〜しています」型）。口語・AIっぽい言い切り・絵文字・Markdown の `**` 禁止。
- **事実には必ず出典URLと確認日（2026-10-xx）を付ける。** 公式・一次情報で確認できないことは書かない（「不明」とするか項目ごと省く）。
- 他サイトの文章・口コミ本文・画像は転載しない（要約・数値の引用＋出典リンクまで）。
- **ASP の計測リンク（t.felmat.net / px.a8.net / af.moshimo.com / rentracks / afi-b 等）は開かない・取得しない。**
- 費用が発生する作業（有料API・有料ツール）はしない。

## 報告
- 作業の区切りごとに、このチャンネルで tomomi-2 にメンションして報告: ブランチ名・コミット・件数・出典の数・確認できず書かなかったこと。
- 5分以上詰まったら即報告。推測で埋めない。
