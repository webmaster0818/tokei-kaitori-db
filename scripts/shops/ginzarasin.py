#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GINZA RASIN（株式会社ラシン）の時計買取「定額買取価格リスト」。調査 2026-10-17。

取得元: https://www.kaitori-ginza.com/<brand>/  （ブランド別ページ1枚に定額買取価格の表がある）
- robots.txt: Disallow は /jisseki/wp-admin/ と feed 等のみ。ブランドページは許可。
- 利用規約: https://www.kaitori-ginza.com/terms/ 。買取サービスの契約条件で、自動取得・転載を名指しで禁じる条文はない。
  第10条（禁止行為）(8)(9)(10) にサービス運営・サーバーの妨害の禁止、第11条（著作権等）に知的財産権の帰属の定めがある。
  → アクセス間隔を空け、ブランドページだけを取得する。文章・画像は転載せず、価格の数値と出典URLのみ扱う。
- 静的HTML。一覧は1ページに全行が入っている（<ul class="pager"> は表示側の分割で、HTMLには全行ある）。
  ロレックスは約1.2MB・535行（ページ表記「定額買取価格リスト3483点公開中」は全ブランド合計の表記）。

1行の形（ブランドで3通りある）:
  [ロレックス] <h3><a href=".../teigaku/124060-price">ロレックス サブマリーナ ノンデイト ブラック 124060</a></h3>
  <p class="souba_specialprice souba_price2">2,000,000円</p>              … 未使用品
  <p class="souba_specialprice souba_price3"> <span …></span> 1,950,000円</p> … 中古品
  [オーデマ・ピゲ] 名前が <p><a href=".../teigaku/...">。価格は souba_price1/2/3（price3 に中古品の額）。
  [その他（オメガ・カルティエ・IWC・パネライ・ウブロ・ヴァシュロン）]
      <p><a href=".../wantedprice/omega_purchase_price_30">オメガ スピードマスター コーアクシャル311.30.44.51.01.002</a></p>
      <p class="souba_specialprice">キャンペーン価格500,000円</p>
      詳細ページの表記は「中古品 キャンペーン価格 ¥500,000」、推移表で同額が毎月続く → 中古品の通常価格として扱う。
      型番が和文に直結しているので切り出す。「キャンペーン価格ASK」は価格なし → 飛ばす。
- 列の意味は商品詳細ページで確認した（124060: 「未使用品買取価格 ¥2,000,000」「中古品 … ¥1,950,000」）。
- 価格の種類: 定額買取（条件を満たした場合にこの額で買い取る）→ price_type=上限（ロデオドライブ・大黒屋と同じ扱い）。
- 更新日: <p class="souba_update"> または <p class="kaitori_update"> の「2026年10月16日 更新」（ブランドページ単位）。
⚠️ <!-- <p class="souba_specialprice souba_price1">1,950,000円</p> --> のようにコメントアウトされた旧価格がある。
   コメントを除いてから読む（読むと存在しない価格を拾う）。
⚠️ 行名に「116519LN NG ホワイトシェル」のように型番の後ろへ NG/G が離れて付く行がある。
   当サイトの型番は 116503NG のように連結しているので、直後の NG / G は連結する。
- 第2弾（2026-10-17）: パテック フィリップ 109型番・チューダー 72型番・グランドセイコー 258型番を追加（既存の parse のまま読める）。
  ⚠️ チューダーは「79363N」（M接頭・文字盤コードなし）。ロデオドライブ・宝石広場は「M79833MN-0003」。
- 行の区別: variant＝行名（店の表記そのまま。例「ロレックス サブマリーナ ノンデイト ブラック 124060」）。
  dial＝行名で型番より後ろに書かれた語（例「ホワイトシェル」。無ければ空欄）。
  文字盤の語は行名の途中に入るのが普通で、モデル名との切れ目は表記から決められないため、行名全体を variant に残す。
⚠️ 同じ型番に複数行（文字盤違い）がある。チューダー 79363N のように行名が完全に同じで価格だけ違う行もある（区別の文言なし）。

★ 2026-10-17 方針変更（tomomi-2）: 同じ型番の行を最大額にまとめず、表の行をすべて返す。
  各行を区別する文言は店の表記のまま dial / material / variant に入れる（推測で補わない。無ければ空欄）。
  ★ variant は PriceRecord に無いキーで、このとき追加した（行を区別する店の表記をそのまま入れる）。
"""
from __future__ import annotations

import re
import sys

try:
    from _common import TODAY, norm_ref, pick_ref, run_test, strip_comments, text, yen
except ImportError:
    from shops._common import TODAY, norm_ref, pick_ref, run_test, strip_comments, text, yen

SHOP = "GINZA RASIN"
SHOP_ID = "ginzarasin"
BASE = "https://www.kaitori-ginza.com/"
URLS = {
    "rolex": BASE + "rolex/",
    "omega": BASE + "omega/",
    "audemarspiguet": BASE + "audemarspiguet/",
    "vacheronconstantin": BASE + "vacheron/",
    "cartier": BASE + "cartier/",
    "iwc": BASE + "iwc/",
    "panerai": BASE + "panerai/",
    "hublot": BASE + "hublot/",
    # 第2弾（2026-10-17）で追加
    "patekphilippe": BASE + "patekphilippe/",
    "tudor": BASE + "tudor/",
    "grandseiko": BASE + "grandseiko/",
}
BRANDS = {"rolex": "ロレックス", "omega": "オメガ", "audemarspiguet": "オーデマ・ピゲ",
          "vacheronconstantin": "ヴァシュロン・コンスタンタン", "cartier": "カルティエ",
          "iwc": "IWC", "panerai": "パネライ", "hublot": "ウブロ",
          "patekphilippe": "パテック フィリップ", "tudor": "チューダー", "grandseiko": "グランドセイコー"}
ENCODING = "utf-8"

PRICE_COLS = (("souba_price2", "未使用"), ("souba_price3", "中古"))
NAME = re.compile(r'<a href="https://www\.kaitori-ginza\.com/(?:teigaku|wantedprice)/[^"]*">([^<]+)</a>')


def _split_ref(tokens: list[str]) -> tuple[int, str] | None:
    """型番トークンを探す。オメガ等は「コーアクシャル311.30.44.51.01.002」のように和文に型番が直結しているので切り出す。"""
    hit = pick_ref(tokens)
    if hit:
        return hit
    for i in range(len(tokens) - 1, -1, -1):
        m = re.search(r"([A-Za-z0-9][A-Za-z0-9./-]{3,})$", tokens[i])
        if m and re.search(r"\d{3,}", m.group(1)) and m.start() > 0:
            tokens[i:i + 1] = [tokens[i][:m.start()], m.group(1)]
            return i + 1, m.group(1)
    return None


def parse(html: str, url: str) -> list[dict]:
    html = strip_comments(html)
    upd = re.search(r'class="(?:souba|kaitori)_update">\s*(\d{4})年(\d{1,2})月(\d{1,2})日', html)
    page_updated = (f"{upd.group(1)}-{int(upd.group(2)):02d}-{int(upd.group(3)):02d}" if upd else None)
    rows: list[dict] = []
    for tr in re.findall(r"<tr>([\s\S]*?)</tr>", html):
        if "souba_specialprice" not in tr:
            continue
        m = NAME.search(tr)
        if not m:
            continue
        row_name = text(m.group(1))
        tokens = row_name.split()
        hit = _split_ref(tokens)
        if not hit:
            continue
        i, raw_ref = hit
        if i + 1 < len(tokens) and tokens[i + 1] in ("NG", "G"):
            raw_ref += tokens[i + 1]
        ref = norm_ref(raw_ref)
        model = " ".join(tokens[1:i])
        tail = " ".join(t for t in tokens[i + 1:] if t not in ("NG", "G"))
        cols = []
        for cls, cond in PRICE_COLS:
            pm = re.search(r'<p class="souba_specialprice ' + cls + r'">([\s\S]*?)</p>', tr)
            if pm:
                cols.append((cond, pm.group(1)))
        if not cols:
            # 3つ目の形（オメガ・カルティエ・IWC 等 /wantedprice/）: 価格1つ「キャンペーン価格500,000円」。
            # 詳細ページの表記は「中古品 キャンペーン価格 ¥500,000」で、推移表でも同額が続く通常の中古品価格。
            cols = [("中古", x) for x in re.findall(r'<p class="souba_specialprice">([\s\S]*?)</p>', tr)[:1]]
        for cond, body in cols:
            v = yen(text(body))
            if not v:
                continue  # 「ASK」等
            rec = {"shop": SHOP, "shop_id": SHOP_ID, "ref": ref, "model": model, "dial": tail, "variant": row_name,
                   "price_type": "上限", "condition": cond, "price_jpy": v, "source_url": url,
                   "page_updated": page_updated, "fetched_at": TODAY}
            rows.append(rec)
    return rows


if __name__ == "__main__":
    if "--test" in sys.argv:
        run_test(SHOP_ID, parse, URLS)
    else:
        print(__doc__)
