# tokei-kaitori-db — 時計買取相場DB(構築中)

型番×日付×各社買取価格の時系列DB。買取店の公開型番別買取価格を定点観測し、
出典明記の引用・比較形式で「AIに引用される相場の一次データ源」を作る。

- `scripts/fetch-watch-prices.py` … 定点観測フェッチャ(ジャックロード/クォーク/大黒屋/なんぼや)
- `data/prices/YYYY-MM-DD.json` … 日次スナップショット
- `data/watch-master.json` … 型番マスタ(観測ベース)
- `data/history/<ref>.json` … 型番別履歴

ルール: 価格の捏造・推定禁止/出典URL+取得日を必ず保持/リクエスト間2秒/robots許可パスのみ。
