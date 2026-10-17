# saburo-2 担当: モデル・買取店・売却ガイドの解説文

## なぜ
モデルハブ（`/model/<slug>/`）とブランドハブは型番の一覧表だけで、「デイトナ 買取相場」「サブマリーナ 売る」のような検索に答える説明が無い。
また、比較している5社について、店ごとのページが無い。

## やること（3種類・すべて `content/` 配下の Markdown）
1. **モデル解説** `content/models/<slug>.md`（`lib/models.ts` の FAMILIES のうち公開中の15モデル: daytona, submariner, gmt-master-2, explorer, datejust, sea-dweller, yacht-master, air-king, milgauss, day-date, oyster-perpetual, sky-dweller, speedmaster, seamaster, royal-oak, overseas）
   - 各 1,500〜2,500字。見出し: 「〈モデル〉の特徴」「主な世代と型番の見分け方」「買取価格が変わる主な要素（素材・文字盤・付属品など）」「よくある質問」(Q&A 3〜5問)
   - 世代・発表年・素材はメーカー公式で確認できたものだけ。価格の数字は書かない（価格はサイトのデータから自動で出すため）
2. **買取店の紹介** `content/shops/<shop_id>.md`（nanboya, daikokuya, quark, jackroad, watchnian の5社）
   - 公式サイトに書かれていること（運営会社・店舗数・査定方法・価格の公開方法・更新頻度）を要約。会社情報は公式の会社概要で確認。キャンペーン等の期間限定情報は書かない
3. **売却ガイド** `content/guides/<slug>.md`（5本: 付属品（箱・保証書）と買取価格／オーバーホール前に売るか／相場の見方（上限額・相場・店舗間の差額）／ロレックスの型番の読み方／買取店の選び方と比較のしかた）
   - 各 2,000〜3,000字。当サイトのデータの読み方とつなげる

## 書式
- 先頭に YAML: `title`, `description`（120字以内）, `sources`（URL と確認日のリスト）
- 本文中で事実を述べた段落の末尾に出典番号 `[1]` を付け、末尾に出典一覧
- ライティング基準 v2・ビジネス文書の日本語（共通ルール参照）。架空の体験談・口コミ・数値は禁止

## 触ってよい場所
`content/` のみ。ページの組み込みは tomomi-2 が行う。まずモデル2本（daytona, submariner）で一度報告 → 確認後に残り。
