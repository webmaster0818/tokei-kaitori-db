#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""不採用（tomomi-2 10/17：一括査定の参考値のため比較の対象外）

ピアゾ（時計専門9社一括査定）の「買取価格相場」表。調査 2026-10-17。

取得元: https://piazo.jp/<brand>/  （ブランド別ページ1枚に全型番の相場表がある）
- robots.txt: User-agent: * は Disallow: /admin/ のみ（MJ12bot / baiduspider / BLEXBot / Yandex は全面拒否。当方は該当しない）。
- 利用規約: 利用規約ページなし。フッターはプライバシーポリシー（https://piazo.jp/policy.php）と
  個人情報の管理（https://piazo.jp/privacy.php）のみで、自動取得・転載の禁止規定なし。
- 静的HTML。ページングなし（ロレックスは約1.4MB・1,722行が1ページに入っている）。

⚠️ ピアゾは買取店ではなく「9社一括査定」の仲介サービス。表の額はピアゾ自身の買取提示額ではない。
   ページ注記（原文の要旨）: 買取価格相場はピアゾの過去の買取査定事例をもとに独自の集計ロジックで算出した参考値で、
   正確性は保証しない。→ price_type=相場。
⚠️ 価格は「1,210,000円〜1,690,000円」の幅表示。PriceRecord は1値なので BOUND で採る側を決める
   （既定は上限側 = "upper"。下限側にする場合は "lower"）。どちらを採ったかはページ側で明示すること。
- 状態: 行名の末尾に「[良品～新品同様]」。→ condition=中古（BOUND の上限側は新品同様寄りの額）。
- 更新日: 表の見出しに「[2026年10月02日更新]」（ブランドページ単位。月1回程度の更新）。
⚠️ ロレックスは「134303-0001」のように文字盤コード（-4桁）付きの行がある。他社は文字盤コードなしで
   型番を持つので、ロレックスに限り末尾の -4桁 を外して型番にし、文字盤コードは dial に残す。
   同じ型番に複数行あるときは最大額を採る。
⚠️ 同じページの「一括査定事例」（A社〜I社の額・査定日つき）は過去の個別事例なので読まない。
"""
from __future__ import annotations

import re
import sys

try:
    from _common import TODAY, norm_ref, pick_ref, run_test, strip_comments, text, yen
except ImportError:
    from shops._common import TODAY, norm_ref, pick_ref, run_test, strip_comments, text, yen

SHOP = "ピアゾ"
SHOP_ID = "piazo"
URLS = {
    "rolex": "https://piazo.jp/rolex/",
    "omega": "https://piazo.jp/omega/",
    "audemarspiguet": "https://piazo.jp/audemarspiguet/",
    "vacheronconstantin": "https://piazo.jp/vacheron/",
    "cartier": "https://piazo.jp/cartier/",
    "iwc": "https://piazo.jp/iwc/",
    "panerai": "https://piazo.jp/panerai/",
    "hublot": "https://piazo.jp/hublot/",
}
BRANDS = {"rolex": "ロレックス", "omega": "オメガ", "audemarspiguet": "オーデマ・ピゲ",
          "vacheronconstantin": "ヴァシュロン・コンスタンタン", "cartier": "カルティエ",
          "iwc": "IWC", "panerai": "パネライ", "hublot": "ウブロ"}
ENCODING = "utf-8"
BOUND = "upper"

ROW = re.compile(
    r'<tr>\s*<td[^>]*>([\s\S]*?)</td>\s*<td class="c-font-right"[^>]*>'
    r'<p class="c-price c-font-red">([^<]*)</p></td>\s*</tr>')


def parse(html: str, url: str) -> list[dict]:
    html = strip_comments(html)
    upd = re.search(r"\[(\d{4})年(\d{2})月(\d{2})日更新\]", html)
    page_updated = f"{upd.group(1)}-{upd.group(2)}-{upd.group(3)}" if upd else None
    is_rolex = "/rolex/" in url
    rows: dict[str, dict] = {}
    for name_html, price_txt in ROW.findall(html):
        name = text(name_html)
        cm = re.search(r"\[([^\]]+)\]\s*$", name)
        cond_label = cm.group(1) if cm else ""
        name = re.sub(r"\s*\[[^\]]+\]\s*$", "", name)
        tokens = name.split()
        hit = pick_ref(tokens)
        if not hit:
            continue
        i, raw_ref = hit
        dial = ""
        if is_rolex:
            m = re.match(r"^(.+?)-(\d{4})$", raw_ref)
            if m:
                raw_ref, dial = m.group(1), m.group(2)
        ref = norm_ref(raw_ref)
        vals = [yen(x) for x in re.findall(r"[\d,]+円", price_txt)]
        vals = [x for x in vals if x]
        if not vals:
            continue
        v = max(vals) if BOUND == "upper" else min(vals)
        rec = {"shop": SHOP, "shop_id": SHOP_ID, "ref": ref, "model": " ".join(tokens[1:i]),
               "dial": dial, "price_type": "相場",
               "condition": "中古" if ("良品" in cond_label or "中古" in cond_label or not cond_label) else cond_label,
               "price_jpy": v, "source_url": url, "page_updated": page_updated, "fetched_at": TODAY}
        if ref not in rows or v > rows[ref]["price_jpy"]:
            rows[ref] = rec
    return list(rows.values())


if __name__ == "__main__":
    if "--test" in sys.argv:
        run_test(SHOP_ID, parse, URLS)
    else:
        print(__doc__)
