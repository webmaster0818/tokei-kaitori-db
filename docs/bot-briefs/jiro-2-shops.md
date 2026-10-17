# jiro-2 担当: 比較する買取店を増やす（データ拡充の本丸）

## なぜ
データには 506 型番があるが、**288 型番は1社しか価格が無く公開できない**（2社以上で比較できる型番だけ公開＝現在 206）。
店を1社増やすたびに「1社だけ」の型番が2社になり、公開ページが増える。ブランドではなく**店を増やすのが最短**（8/28 の実績: ウォッチニアン追加で +26 型番）。

## やること
1. 候補店の調査（7/29 の検証で取得可と判定済み: 宝石広場 / ロデオドライブ / ピアゾ。ほかに型番別の買取価格を公開している店があれば追加）。各店について:
   - robots.txt で対象ページが許可されているか、利用規約に自動取得・掲載の禁止が無いか（無ければ「禁止規定なし」と記録。あれば対象外）
   - 型番・価格・価格の種類（上限／通常／相場）・状態（新品・中古）・更新日が取れるか
   - 現行の公開型番・1社だけの型番と**何型番一致するか**（`data/watch-master.json` と最新の `data/prices/*.json` の `ref` で突合。型番は `norm_ref` と同じく大文字・記号除去で比較）
2. 取得できる店ごとにパーサを書く: `scripts/shops/<shop_id>.py` に `parse(html: str, url: str) -> list[dict]` と取得URL一覧 `URLS`。返す dict は既存の `PriceRecord` と同じキー（shop, shop_id, ref, model, dial, material, price_type, condition, price_jpy, price_month, source_url, page_updated, fetched_at）。
3. `scripts/shops/samples/<shop_id>/` に取得したHTMLを1〜2本保存し、`python3 scripts/shops/<shop_id>.py --test` でサンプルからレコード数と先頭5件を出せるようにする。
4. 報告に入れること: 店ごとのレコード数・型番数・**新たに2社以上になる型番の数**（＝公開が増える見込み）・robots/規約の確認結果と URL・取得間隔の注意（アクセスは1秒以上空ける）。

## 触ってよい場所
`scripts/shops/` のみ。既存の `scripts/fetch-watch-prices.py` への組み込みと日次への追加は tomomi-2 が行う。
