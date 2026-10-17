#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""宝石広場（株式会社ユーズカンパニー）の時計買取「買取商品一覧」。調査 2026-10-17。

取得元: https://www.housekihiroba-kaitori.jp/watch_brand/<id>  （ブランド別ページ1枚）
- robots.txt: Disallow は /_hcms/perf, /media, /contact/watch/?, /contact/jewelry/? 等のみ。/watch_brand/ は許可。
- 利用規約: 利用規約ページなし（フッターはプライバシーポリシーのみ）。
  ⚠️ 全ページのフッターに「※当WEBサイト掲載写真の無断転載・外部リンクを禁じます。」とある。
     写真の転載・直リンクの禁止と読める。当サイトは写真を使わず、価格の数値と出典URLのみを扱う前提。
     （「外部リンク」の範囲は明記がない。掲載可否の最終判断は tomomi-2 / MediaXAI に委ねる）
- HubSpot CMS の静的HTML。一覧は1ページに全件入っている（2件目以降は style="display: none;" で
  隠してあるだけで、HTMLには存在する）。ページングの追加取得は不要。ロレックスは約1.5MB・766件。

1件 = 1カード:
  <a href="/watch_product/rx2506" class="product-link"> …
    <li>買取価格:</li><li class="text_right red_text">〜8,400,000円</li>
    <span>コスモグラフ デイトナ</span><span>116508NG</span><span>色:ホワイト</span><span>材質:イエローゴールド</span>
- 価格の種類: 「〜」付きの上限表示 → price_type=上限。
- 状態: 一覧には書かれていない（condition=None）。
  商品詳細ページ（/watch_product/…）には「買取価格（未使用品）：〜2,300,000円 更新日：2026-03-02」
  「買取価格（中古品）：〜2,100,000円 更新日：2026-08-25」のように状態別の額と更新日がある。
  一覧の額は詳細ページの先頭の額（未使用品があれば未使用品、無ければ中古品）と一致した
  （2026-10-17 実測: rx2506=中古品、rx2950/rx2952/rx3004/rx3150=未使用品）。
  ⚠️ 一覧の額を「中古の上限」として他社と比べると、未使用品の額を中古に混ぜることになる。
     状態をそろえて比べるには、対象の型番だけ詳細ページを取得して parse() に渡す（下記）。
- 更新日: 一覧には無い。詳細ページに状態ごとにある。
  ⚠️ 実測では 2026-02〜2026-08 の日付で、数か月更新されていない額がある（上記5件すべて 10月の更新ではない）。

parse() は一覧ページと詳細ページの両方を受け付ける:
  一覧（/watch_brand/<id>）  → 1型番1レコード・condition=None・page_updated=None
  詳細（/watch_product/<id>）→ 状態ごとのレコード・condition=未使用/中古・page_updated=その額の更新日
detail_urls(一覧HTML) で {型番: [詳細URL, …]} が取れる。日次で全件（ロレックスだけで766ページ）を巡回するのは
重いので、他社と突合できる型番（公開中・1社だけの型番）に絞って詳細を取る想定。
⚠️ 同じ型番が文字盤色・素材ごとに複数カードある → 型番ごとに最大額を採る。
⚠️ 価格が「お問い合わせ」のカードは飛ばす（0円にしない）。
"""
from __future__ import annotations

import re
import sys

try:
    from _common import TODAY, norm_ref, run_test, strip_comments, text, yen
except ImportError:
    from shops._common import TODAY, norm_ref, run_test, strip_comments, text, yen

SHOP = "宝石広場"
SHOP_ID = "housekihiroba"
BASE = "https://www.housekihiroba-kaitori.jp/watch_brand/"
URLS = {
    "detail_rx2950": "https://www.housekihiroba-kaitori.jp/watch_product/rx2950",  # 詳細ページのサンプル（126610LN）
    "rolex": BASE + "226",
    "omega": BASE + "170",
    "audemarspiguet": BASE + "201",
    "vacheronconstantin": BASE + "228",
    "cartier": BASE + "204",
    "iwc": BASE + "209",
    "panerai": BASE + "223",
    "hublot": BASE + "208",
}
BRANDS = {"rolex": "ロレックス", "omega": "オメガ", "audemarspiguet": "オーデマ・ピゲ",
          "vacheronconstantin": "ヴァシュロン・コンスタンタン", "cartier": "カルティエ",
          "iwc": "IWC", "panerai": "パネライ", "hublot": "ウブロ"}
ENCODING = "utf-8"

CARD = re.compile(r'<a href="(/watch_product/[^"]+)" class="product-link">([\s\S]*?)</a>')


SITE = "https://www.housekihiroba-kaitori.jp"
DETAIL_PRICE = re.compile(
    r"<dt>買取価格（(未使用品|中古品)）：</dt>\s*<dd>([\s\S]*?)</dd>")


def detail_urls(list_html: str) -> dict[str, list[str]]:
    """一覧ページから {型番(norm_ref): [詳細ページURL, …]} を作る（文字盤・素材違いで複数あり）。"""
    out: dict[str, list[str]] = {}
    for href, body in CARD.findall(strip_comments(list_html)):
        spans = [text(x) for x in re.findall(r"<span>([\s\S]*?)</span>", body)]
        if len(spans) >= 2 and re.search(r"\d{3,}", spans[1]):
            out.setdefault(norm_ref(spans[1]), []).append(SITE + href)
    return out


def parse_detail(html: str, url: str) -> list[dict]:
    html = strip_comments(html)
    spec = dict((text(k), text(v)) for k, v in re.findall(
        r"<li>\s*<div>([^<]+)</div>\s*<div>([\s\S]*?)</div>\s*</li>",
        (re.search(r'<ul id="model_spec">([\s\S]*?)</ul>', html) or re.match("", "")).group(0) or ""))
    if not spec.get("型番"):
        return []
    ref = norm_ref(spec["型番"])
    title = re.search(r"<h2 class=\"pph_main_title\">([^<]+?)\s*[A-Za-z0-9./-]+の買取金額推移</h2>", html)
    model = text(title.group(1)) if title else ""
    out = []
    for cond, dd in DETAIL_PRICE.findall(html):
        pm = re.search(r'<span class="red_text">([^<]*)</span>', dd)
        if not pm:
            continue
        v = yen(pm.group(1))
        if not v:
            continue
        um = re.search(r"更新日：(\d{4}-\d{2}-\d{2})", dd)
        out.append({"shop": SHOP, "shop_id": SHOP_ID, "ref": ref, "model": model,
                    "dial": spec.get("色", ""), "material": spec.get("材質名", ""),
                    "price_type": "上限" if ("〜" in pm.group(1) or "～" in pm.group(1)) else "通常",
                    "condition": "未使用" if cond == "未使用品" else "中古", "price_jpy": v,
                    "source_url": url, "page_updated": um.group(1) if um else None, "fetched_at": TODAY})
    return out


def parse(html: str, url: str) -> list[dict]:
    if "/watch_product/" in url:
        return parse_detail(html, url)
    html = strip_comments(html)
    rows: dict[str, dict] = {}
    for _href, body in CARD.findall(html):
        pm = re.search(r'<li class="text_right red_text">([^<]*)</li>', body)
        if not pm:
            continue
        price_txt = pm.group(1)
        v = yen(price_txt)
        if not v:
            continue
        spans = [text(x) for x in re.findall(r"<span>([\s\S]*?)</span>", body)]
        if len(spans) < 2:
            continue
        model, raw_ref = spans[0], spans[1]
        if not re.search(r"\d{3,}", raw_ref) or " " in raw_ref.strip():
            continue
        ref = norm_ref(raw_ref)
        dial = next((s.split(":", 1)[1] for s in spans if s.startswith("色:")), "")
        material = next((s.split(":", 1)[1] for s in spans if s.startswith("材質:")), "")
        rec = {"shop": SHOP, "shop_id": SHOP_ID, "ref": ref, "model": model, "dial": dial,
               "material": material,
               "price_type": "上限" if ("〜" in price_txt or "～" in price_txt) else "通常",
               "condition": None, "price_jpy": v, "source_url": url,
               "page_updated": None, "fetched_at": TODAY}
        if ref not in rows or v > rows[ref]["price_jpy"]:
            rows[ref] = rec
    return list(rows.values())


if __name__ == "__main__":
    if "--test" in sys.argv:
        run_test(SHOP_ID, parse, URLS)
    else:
        print(__doc__)
