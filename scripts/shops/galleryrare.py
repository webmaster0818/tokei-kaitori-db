#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ギャラリーレア（株式会社サークラックス）の時計「買取価格表」。調査 2026-10-17。

取得元: https://galleryrare.jp/watch/rolex/  （型番別の買取価格表があるのはロレックスのページだけ）
- 証明書: 前回（10/17 第1弾）の証明書エラーは、当方が www.galleryrare.jp を叩いていたため。
  証明書は galleryrare.jp（www なし）に対して発行されており、galleryrare.jp では検証が通る
  （openssl の検証結果 0 (ok)・curl / Python の既定の検証でも成功）。検証を切る必要はない。
- robots.txt（https://galleryrare.jp/robots.txt）: User-agent: * に Disallow なし。
- 利用規約: サイトの利用規約ページはなく、フッターは「店頭買取利用規約」（PDF:
  https://galleryrare.co.jp/pdf/agreement_shop.pdf ・店頭買取の契約条件）と各種プライバシー方針。
  自動取得・転載の禁止規定なし。
- 静的HTML。ロレックスのページ（約1MB）に「ロレックス(ROLEX)時計の 買取価格表」がシリーズ別の表で入っている。
  オメガ・パテック・カルティエ・IWC・パネライ・ウブロ・チューダー・オーデマ ピゲ・ヴァシュロン・セイコーの
  ページは「買取実績」（過去の取引額）だけで価格表はない（2026-10-17 実測）。

1行の形:
  <td class="pricetable__name">コスモグラフ デイトナ<span>SS / ホワイト文字盤 / ランダム / 126500LN</span></td>
  <td class="pricetable__price">5,969,000</td>   … 未使用買取価格（税込）
  <td class="pricetable__price">5,682,000</td>   … 中古買取価格（税込）
  価格が無い列は「-」。PC用の行（display__pc-tr）とタブレット用の行に同じ内容が重複しているので PC 用だけ読む。
- 価格の種類: 表の上に「各コンディションの買取価格は、お品物の状態が次の条件を満たす場合に適用されます」
  （未使用: コマ未調整・付属品完備・保証書日付1か月以内／中古: 目立つ傷なし・正常動作・箱/保証書/余りゴマ付属）。
  条件を満たした場合の額 → price_type=上限（ロデオドライブ・GINZA RASIN と同じ扱い）。
- 更新日: 価格表の直前の <time> 「更新日：2026年10月13日」。
⚠️ 同じページの「高価買取実績」（○年○月お取引の買取実績）は過去の取引額なので読まない。
⚠️ 同じ型番に文字盤違いの行がある → (型番, 状態) ごとに最大額を採る。
"""
from __future__ import annotations

import re
import sys

try:
    from _common import TODAY, norm_ref, run_test, strip_comments, text, yen
except ImportError:
    from shops._common import TODAY, norm_ref, run_test, strip_comments, text, yen

SHOP = "ギャラリーレア"
SHOP_ID = "galleryrare"
URLS = {"rolex": "https://galleryrare.jp/watch/rolex/"}
BRANDS = {"rolex": "ロレックス"}
ENCODING = "utf-8"

ROW = re.compile(
    r'<tr class="display__pc-tr">\s*<td class="pricetable__thumb">[\s\S]*?</td>\s*'
    r'<td class="pricetable__name">([\s\S]*?)</td>((?:\s*<td class="pricetable__price">[^<]*</td>)+)')


def parse(html: str, url: str) -> list[dict]:
    html = strip_comments(html)
    start = html.find('class="pricetable__table"')
    if start < 0:
        return []
    head = html[max(0, start - 6000):start]
    um = re.findall(r"更新日：(\d{4})年(\d{1,2})月(\d{1,2})日", head)
    page_updated = f"{um[-1][0]}-{int(um[-1][1]):02d}-{int(um[-1][2]):02d}" if um else None
    rows: dict[tuple[str, str], dict] = {}
    for name_html, prices_html in ROW.findall(html[start:]):
        m = re.match(r"([\s\S]*?)<span>([\s\S]*?)</span>", name_html)
        if not m:
            continue
        model = text(m.group(1))
        parts = [p.strip() for p in text(m.group(2)).split("/")]
        raw_ref = parts[-1] if parts else ""
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9./-]{3,}", raw_ref) or not re.search(r"\d{3,}", raw_ref):
            continue
        ref = norm_ref(raw_ref)
        dial = " / ".join(parts[:-1])
        prices = re.findall(r'<td class="pricetable__price">([^<]*)</td>', prices_html)
        for cond, raw in zip(("未使用", "中古"), prices):
            v = yen(raw)
            if not v:
                continue  # 「-」
            rec = {"shop": SHOP, "shop_id": SHOP_ID, "ref": ref, "model": model, "dial": dial,
                   "price_type": "上限", "condition": cond, "price_jpy": v, "source_url": url,
                   "page_updated": page_updated, "fetched_at": TODAY}
            k = (ref, cond)
            if k not in rows or v > rows[k]["price_jpy"]:
                rows[k] = rec
    return list(rows.values())


if __name__ == "__main__":
    if "--test" in sys.argv:
        run_test(SHOP_ID, parse, URLS)
    else:
        print(__doc__)
