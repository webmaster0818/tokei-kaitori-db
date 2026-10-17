# taro-2 担当: 型番スペックDB（型番ページの中身を厚くする）

## なぜ
型番ページの本文は約2,000字で、Google の判定は「クロール済み・未登録」がほとんど（抜き取り 32本中 登録0）。
価格表だけでは薄い。**型番ごとの公式スペック**を足して、型番ページを「その時計の基本情報＋相場」のページにする。

## やること
公開中の型番（`data/watch-master.json` のうち、最新の `data/prices/*.json` で2社以上に価格がある型番。まずロレックス→オメガ→AP→VC の順）について、型番ごとに `data/specs/<ref小文字>.json` を作る:

```json
{
  "ref": "126610LN",
  "brand": "ロレックス",
  "model": "サブマリーナー デイト",
  "case_diameter_mm": 41,
  "case_material": "オイスタースチール",
  "bezel": "…",
  "dial": "…",
  "movement": "Cal.3235（自動巻き）",
  "power_reserve_h": 70,
  "water_resistance_m": 300,
  "bracelet": "…",
  "status": "現行" ,
  "release_year": 2020,
  "sources": [{"url": "https://www.rolex.com/ja/…", "checked": "2026-10-18", "fields": ["case_diameter_mm","movement", "…"]}]
}
```

- **出典はメーカー公式を最優先**（rolex.com / omegawatches.jp / audemarspiguet.com / vacheron-constantin.com）。生産終了品で公式に無いものは、メーカー公式のプレスリリース・アーカイブ、または信頼できる専門誌の記事。**確認できない項目は書かない（キーごと省く）。** 推測で埋めない。
- 各項目がどの出典から来たか `sources[].fields` で分かるようにする。
- 表記は公式の日本語表記に合わせる。
- 終わったら `data/specs/_index.json` に、作成した型番・未作成の型番（理由付き）を一覧にする。

## 触ってよい場所
`data/specs/` のみ。ページへの表示は tomomi-2 が実装する。
まず 20 型番で一度報告 → tomomi-2 が形式を確認 → 残りを進める。
