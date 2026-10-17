# グランドセイコー 型番とコレクションの対応（調査 2026-10-17・jiro-2）

コードは変更していない。対応表は gs-ref-collection.json。families-proposal.json の GS 部分はこの結果に合わせて更新した（families-proposal.md の11章 第3版）。

## 1. 結論

- 4店＋既存5社に出てくるグランドセイコーの型番 264 件のうち、145 件をGS公式の製品ページでコレクションに対応付けた（現行の公式ページ 34 件、Wayback Machine に保存された公式ページ 111 件）。119 件は確認できなかった。
- コレクションごとの件数: ヘリテージコレクション 98、エボリューション9 コレクション 2、スポーツコレクション 25、エレガンスコレクション 20、マスターピースコレクション 0。
- 2社以上の価格がある型番は、宝石広場を含めないと0件、含めると 15 件（対応付けできなかった型番を含めると 26 件）。宝石広場を含めないと0件なのは、採用済みの店でグランドセイコーの価格を出しているのが GINZA RASIN だけのため（ロデオドライブは価格表なし、ギャラリーレアはロレックスのみ、既存5社はマスタにグランドセイコーが無い）。
- ページ化の対象（2社以上の価格がある型番が2つ以上）は、宝石広場を含めないと0件、含めると 2 件（ヘリテージコレクション（10）、スポーツコレクション（4））。

## 2. 確認方法

- 型番の一覧: families-proposal と同じ集計（4店のブランドページ 2026-10-17 取得分＋data/prices/2026-10-17.json）に出てくるグランドセイコーの型番。
- 現行の公式ページ: https://www.grand-seiko.com/jp-ja/collections/<型番> を全型番について1.2秒間隔で開いた（robots.txt は全許可）。製品ページの型番の直後に書かれたコレクション名を読んだ。公式の日本語サイトマップ（https://www.grand-seiko.com/vendor/sitemap?xml=jp-jaGrandSeikoSitemap1.xml ・2026-10-17）に載る製品ページは146件で、今回の型番と一致したのは33件（SLGH005 はサイトマップに無いがページはあった）。
- 保存版: Wayback Machine の CDX 検索で grand-seiko.com/jp-ja/collections/ 以下の保存済みURLを型番の先頭4文字ごとに一覧にし（17回）、現行ページが404だった型番について保存版を開いた。最新の保存版から年ごとに1件ずつさかのぼり、製品情報のある最初の保存版を採った（保存版でも404ページのものがあるため）。
  - 2022年以降の保存版は現行と同じ形式で、型番の直後に日本語のコレクション名がある。
  - 2019〜2021年の保存版は日本語ページでもコレクション名が英語で「[ Grand Seiko Heritage Collection ]」のように書かれている。これを現行の日本語の公式名称（ヘリテージコレクション等）に読み替え、ページの表記を page_label に残した（Heritage／Sport／Elegance の3種のみ出現）。
- 旧公式サイト（www.grand-seiko.jp・2017年ごろ）: grand-seiko.com に保存版が無い型番のうち、旧サイトの製品ページの保存版がある型番は開いて確認した。旧サイトの製品ページはムーブメントの区分（[ 9Rスプリングドライブ ]・[ 9Fクオーツ ]・[ 9Sメカニカル ] 等）だけで、ヘリテージ等のコレクションの記載はなかった。このため対応付けには使っていない。
- 型番の形（SBGA・SBGH 等の接頭辞）からは推測していない。

注意: 保存版のコレクションは保存した時点の分類。公式で分類が変わった例がある（SLGH005 は店の行名ではヘリテージコレクション、現行の公式ページではエボリューション9 コレクション）。保存版で対応付けた型番の保存日は snapshot に入れた。
保存版の年: 2019年 13件、2020年 26件、2021年 62件、2022年 2件、2025年 3件、2026年 5件。

## 3. コレクションごとの件数

| コレクション | slug | 型番数 | うち現行ページ | うち保存版 | 2社以上（宝石広場なし） | 2社以上（宝石広場あり） | ページ化（なし／あり） |
|---|---|---|---|---|---|---|---|
| ヘリテージコレクション | gs-heritage | 98 | 24 | 74 | 0 | 10 | -／対象 |
| エボリューション9 コレクション | gs-evolution9 | 2 | 1 | 1 | 0 | 0 | -／- |
| スポーツコレクション | gs-sport | 25 | 5 | 20 | 0 | 4 | -／対象 |
| エレガンスコレクション | gs-elegance | 20 | 4 | 16 | 0 | 1 | -／- |
| マスターピースコレクション | gs-masterpiece | 0 | 0 | 0 | 0 | 0 | -／- |
| （確認できず） | - | 119 | - | - | 0 | 11 | - |
| 合計 | - | 264 | 34 | 111 | 0 | 26 | - |

2社以上の価格がある型番（宝石広場あり）の内訳: ヘリテージコレクション: SBGA301・SBGE213・SBGH201・SBGH205・SBGH245・SBGJ201・SBGJ203・SBGR251・SBGV221・SBGV225、スポーツコレクション: SBGA231・SBGC201・SBGE201・SBGN003、エレガンスコレクション: SBGA407。

## 4. 確認できなかった型番

119 件。★ は宝石広場を含めると2社以上の価格がある型番。

### 公式（grand-seiko.com・旧 grand-seiko.jp）に製品ページなし・保存版なし（66）

SBGA003、SBGA025、SBGA029、SBGA031、SBGA041、SBGA059、SBGA073、SBGA075、SBGA105、SBGA127、SBGA129、SBGB001、SBGB003、SBGC001、SBGC003、SBGC005、SBGC007、SBGH001、SBGH005、SBGH007、SBGH013、SBGH035、SBGH037、SBGH039、SBGJ001、SBGJ003、SBGJ005、SBGJ013、SBGM021、SBGM023、SBGM025、SBGM029、SBGM031、SBGR055、SBGR057、SBGR061、SBGR069、SBGR071、SBGR073、SBGR077、SBGR079★、SBGR083★、SBGR087★、SBGR089、SBGR095、SBGR289、SBGT035、SBGT037、SBGT038、SBGT241、SBGW031、SBGW035、SBGW047、SBGX005、SBGX009、SBGX041、SBGX053、SBGX061、SBGX065、SBGX067、SBGX069★、STGF293、STGF297、STGF310、STGF312、STGF316

### 公式（grand-seiko.com）に製品ページなし・保存版なし。旧公式サイト（grand-seiko.jp）の保存版はあるが、コレクションの記載なし（ムーブメントの区分のみ）（39）

SBGA001、SBGA011、SBGA079、SBGA081、SBGA083、SBGA085、SBGA093、SBGA099、SBGA101★、SBGE005、SBGE009、SBGE011、SBGE013、SBGE015、SBGE025、SBGE027、SBGJ011、SBGM027、SBGR051、SBGR067、SBGV005、SBGV007、SBGV013、SBGV015、SBGV017、SBGX055、SBGX059★、SBGX063★、SBGX071、SBGX073、SBGX083、SBGX085、SBGX087、SBGX091、SBGX093★、SBGX097、SBGX115★、SBGX117★、STGF313

### 公式（grand-seiko.com）の製品ページは現在404。保存版もすべて404ページで、製品情報なし（13）

SBGA203、SBGA293、SBGA299★、SBGA349、SBGA425、SBGA461、SBGH213、SBGN005、SBGR321、SBGX269、SBGX321、STGF287、STGF329

### 公式（grand-seiko.com）に製品ページなし・保存版なし。旧公式サイト（grand-seiko.jp）の保存版は一覧にあるが取得できず（1）

SBGX095

旧公式サイトで確認した保存版（コレクションの記載なし）:

- SBGA001: https://web.archive.org/web/20170908002649/http://www.grand-seiko.jp:80/collections/SBGA001/（9Rスプリングドライブ）
- SBGA011: https://web.archive.org/web/20170728184827/https://www.grand-seiko.jp/collections/SBGA011/（9Rスプリングドライブ）
- SBGA079: https://web.archive.org/web/20170420101700/http://www.grand-seiko.jp:80/collections/SBGA079/（9Rスプリングドライブ）
- SBGA081: https://web.archive.org/web/20170508190702/http://www.grand-seiko.jp:80/collections/SBGA081（9Rスプリングドライブ）
- SBGA083: https://web.archive.org/web/20170508212824/http://www.grand-seiko.jp:80/collections/SBGA083（9Rスプリングドライブ）
- SBGA085: https://web.archive.org/web/20170508210629/http://www.grand-seiko.jp:80/collections/SBGA085（9Rスプリングドライブ）
- SBGA093: https://web.archive.org/web/20170420101710/http://www.grand-seiko.jp:80/collections/SBGA093/（9Rスプリングドライブ）
- SBGA099: https://web.archive.org/web/20170621083100/http://www.grand-seiko.jp:80/collections/SBGA099（9Rスプリングドライブ）
- SBGA101: https://web.archive.org/web/20170420101715/http://www.grand-seiko.jp:80/collections/SBGA101/（9Rスプリングドライブ）
- SBGE005: https://web.archive.org/web/20170420101720/http://www.grand-seiko.jp:80/collections/SBGE005/（9Rスプリングドライブ）
- SBGE009: https://web.archive.org/web/20170621084000/http://www.grand-seiko.jp:80/collections/SBGE009（9Rスプリングドライブ）
- SBGE011: https://web.archive.org/web/20170420101725/http://www.grand-seiko.jp:80/collections/SBGE011/（9Rスプリングドライブ）
- SBGE013: https://web.archive.org/web/20170420101730/http://www.grand-seiko.jp:80/collections/SBGE013/（9Rスプリングドライブ）
- SBGE015: https://web.archive.org/web/20170420101735/http://www.grand-seiko.jp:80/collections/SBGE015/（9Rスプリングドライブ）
- SBGE025: https://web.archive.org/web/20170420101740/http://www.grand-seiko.jp:80/collections/SBGE025/（9Rスプリングドライブ）
- SBGE027: https://web.archive.org/web/20170420101855/http://www.grand-seiko.jp:80/collections/SBGE027/（9Rスプリングドライブ）
- SBGJ011: https://web.archive.org/web/20170531090207/http://www.grand-seiko.jp:80/collections/SBGJ011（9Sメカニカル）
- SBGM027: https://web.archive.org/web/20170914055442/http://www.grand-seiko.jp:80/collections/SBGM027/（9Sメカニカル）
- SBGR051: https://web.archive.org/web/20170602080838/http://www.grand-seiko.jp:80/collections/SBGR051（9Sメカニカル）
- SBGR067: https://web.archive.org/web/20170401004633/http://www.grand-seiko.jp:80/collections/SBGR067（9Sメカニカル）
- SBGV005: https://web.archive.org/web/20170508212032/http://www.grand-seiko.jp:80/collections/SBGV005（9Fクオーツ）
- SBGV007: https://web.archive.org/web/20170508190713/http://www.grand-seiko.jp:80/collections/SBGV007（9Fクオーツ）
- SBGV013: https://web.archive.org/web/20170602071806/http://www.grand-seiko.jp:80/collections/SBGV013（9Fクオーツ）
- SBGV015: https://web.archive.org/web/20170326144455/http://www.grand-seiko.jp:80/collections/SBGV015（9Fクオーツ）
- SBGV017: https://web.archive.org/web/20170609081116/http://www.grand-seiko.jp:80/collections/SBGV017（9Fクオーツ）
- SBGX055: https://web.archive.org/web/20170508203333/http://www.grand-seiko.jp:80/collections/SBGX055（9Fクオーツ）
- SBGX059: https://web.archive.org/web/20170914060443/http://www.grand-seiko.jp:80/collections/SBGX059/（9Fクオーツ）
- SBGX063: https://web.archive.org/web/20170719225204/http://www.grand-seiko.jp:80/collections/SBGX063/（9Fクオーツ）
- SBGX071: https://web.archive.org/web/20170326144530/http://www.grand-seiko.jp:80/collections/SBGX071/（9Fクオーツ）
- SBGX073: https://web.archive.org/web/20170326144535/http://www.grand-seiko.jp:80/collections/SBGX073/（9Fクオーツ）
- SBGX083: https://web.archive.org/web/20170925092451/http://www.grand-seiko.jp:80/collections/SBGX083（9Fクオーツ）
- SBGX085: https://web.archive.org/web/20170326144540/http://www.grand-seiko.jp:80/collections/SBGX085/（9Fクオーツ）
- SBGX087: https://web.archive.org/web/20170326174550/http://www.grand-seiko.jp:80/collections/SBGX087/（9Fクオーツ）
- SBGX091: https://web.archive.org/web/20170905081956/http://www.grand-seiko.jp:80/collections/SBGX091（9Fクオーツ）
- SBGX093: https://web.archive.org/web/20170424054409/http://www.grand-seiko.jp:80/collections/SBGX093/（9Fクオーツ）
- SBGX097: https://web.archive.org/web/20170326144550/http://www.grand-seiko.jp:80/collections/SBGX097/（9Fクオーツ）
- SBGX115: https://web.archive.org/web/20170328075408/http://www.grand-seiko.jp:80/collections/SBGX115/（9Fクオーツ）
- SBGX117: https://web.archive.org/web/20170331205439/http://www.grand-seiko.jp:80/collections/SBGX117/（9Fクオーツ）
- STGF313: https://web.archive.org/web/20170908202003/http://www.grand-seiko.jp:80/collections/STGF313（レディスモデル）

## 5. families-proposal.json の変更点（GS部分）

- 第1版: 公式の現行ページで確認できた34型番＋店の行名に「ヘリテージコレクション」等がある型番を振り分けていた。
- 今回: この対応表の 145 型番だけを振り分け、行名による振り分けをやめた。keys は空にし、ref_keys（＝この対応表の型番）で引く形にした。
- 件数: gs-heritage 98、gs-evolution9 2、gs-sport 25、gs-elegance 20、gs-masterpiece 0。ページ化の対象（宝石広場あり）は gs-heritage・gs-sport の2件になった（第1版は gs-heritage の1件）。

## 6. 出典

- 現行の公式製品ページ 34 件（確認日 2026-10-17）と、Wayback Machine に保存された公式製品ページ 111 件（保存日は snapshot）。URL は gs-ref-collection.json の source_url。
- GS公式の日本語サイトマップ: https://www.grand-seiko.com/vendor/sitemap?xml=jp-jaGrandSeikoSitemap1.xml （確認日 2026-10-17）
- コレクション名の一覧: https://www.grand-seiko.com/jp-ja （確認日 2026-10-17。マスターピースコレクション・エボリューション9 コレクション・ヘリテージコレクション・スポーツコレクション・エレガンスコレクション）
- 旧公式サイトの保存版 39 件（4章。対応付けには使っていない）
- 出典URLの数: 対応付けの根拠 145 件＋サイトマップ1件＋コレクション一覧1件＝147 件（ほかに、確認できなかった根拠として旧公式サイトの保存版 39 件）。

## 7. 確認できず書かなかったこと

- 2019〜2021年の保存版の英語表記（Grand Seiko Heritage Collection 等）が、日本語の公式名称と同じコレクションを指すことを明記した公式の記載。今回は名称の対応（Heritage→ヘリテージ等）で読み替えた。
- 保存版で対応付けた型番が、その後の公式の分類変更で別のコレクションに移ったかどうか（生産終了で現行ページが無いため確認できない）。
- 旧公式サイト（grand-seiko.jp）時代の型番のコレクション。当時の公式ページにコレクションの区分が無かった。
