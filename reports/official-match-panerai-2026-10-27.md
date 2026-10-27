# パネライ73型番 公式照合（2026-10-27）

対象: `reports/match-prep-panerai-2026-10-26.tsv` の73型番（ロデオドライブ＋GINZA RASIN の2社。PAM00422 のみウォッチニアンも）。
結果の明細: `reports/official-match-panerai-2026-10-27.tsv`（73行・全件照合済み）。

## 結果
| 判定 | 本数 |
|---|---|
| 一致 | 0 |
| 一部不一致（PAM00422） | 1 |
| 公式に無い | 72 |

- **PAM00422**: 公式の現行品（https://www.panerai.com/jp/ja/collections/watch-collection/luminor/pam00422-luminor.html）。
  公式: 名称 Luminor（title「Panerai Luminor PAM 422 47mm Manual Wind」）・47 mm・スティール（AISI 316L polished steel）・ブラック文字盤 9時位置スモールセコンド・手巻き P.3001・パワーリザーブ3日間。
  店の掲載名「ルミノール マリーナ1950 3デイズ」（ロデオ）／「ルミノール マリーナ 1950 3DAYS アッチャイオ 47mm ブラック」（GINZA RASIN）／「ルミノール」（ウォッチニアン）。
  → 47mm・スティール・ブラックは一致。**「マリーナ」「1950」「3デイズ」は公式の現行名に無い**。旧称かどうかは公式で確認できないので判断しない。
- **72本は公式に無い**: 公式サイトの検索（JP・US・INT・IT の4地域）で0件、現行コレクション一覧（ルミノール/ラジオミール/サブマーシブル/ルミノール ドゥエ/マリーナ・ミリターレ＝144型番、`official-panerai-current-refs-2026-10-27.txt`）にも無い。生産終了品の可能性が高いが、公式で確認できたわけではない。
  - PAM01312: 旧URL `.../luminor/pam01312-luminor-marina.html` は公式で PAM03312（ルミノール マリーナ 44mm）へリダイレクトされる。同一品とは扱わない。

## 方法
- panerai.com は curl / WebFetch では 403（Akamai）。ヘッドレス Chrome（CDP）でページを開き、公式ページ自身が使う検索 API `/jp/ja/search/free-search/_jcr_content/par/search_result.search.json?q=<型番>` を同じページから呼んだ。対照として現行の PAM03312・PAM01629・PAM01707・PAM00422 は全てヒット（検索が機能していることを確認）。
- 生産終了品の公式アーカイブ確認として Wayback（web.archive.org）CDX を試したが「Temporarily Offline」で不可。

## 未確認
- 72本の名称・ケース径（公式の現行サイトに情報なし）。確かめる手段は Wayback の旧公式ページ（復旧後）か、パネライ公式のプレスリリース等。
