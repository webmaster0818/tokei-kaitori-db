#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ロデオドライブ（株式会社アールケイエンタープライズ）の買取査定表。調査 2026-10-17。

取得元: https://kaitori.rodeodrive.co.jp/brand/<brand>/  （ブランド別ページ1枚に全モデルの表がある）
- robots.txt: Disallow は /items/ と /kit/? のみ。/brand/ は許可。
- 利用規約: 買取サイトに利用規約ページなし。フッターのリンク先は運営会社の基本方針
  （https://www.rk-enterprise.jp/policy/ ・個人情報とCookieの方針）のみで、自動取得・転載の禁止規定なし。
- 静的HTML（JS描画なし）。ページングなし。ロレックスのページは約1.5MB・362行。

表の形:
  ロレックス … 列が「新品 / 未使用品 / 中古品」の3価格。
               PC用セル（serv_tbl_spnone）とSP用セル（ラベル付きの <p>）に同じ価格が重複して入っている。
               → SP用セル（ラベル付き）だけを読む。
  その他       … 「買取価格」1列。ページ上部の注記で「中古Ａランクで現行モデル」…の条件を満たす場合の価格と明記。
- 価格の種類: ページ本文「以上の全ての条件を満たしている場合は定額買取り査定表の価格で買取いたします」。
  条件を満たした最良状態の定額＝実質の上限なので price_type は「上限」とする（大黒屋と同じ扱い）。
- 更新日: 見出し直下の <time datetime="2026-10-13">（ブランドページ単位）。
⚠️ 同じページの「高価買取実績」（掲載日つき・買取価格：）は過去の買取額で提示額ではないので読まない。
   serv_tbl の行だけを対象にする。
⚠️ 「お問い合わせ」等、数字の無いセルは飛ばす（0円にしない）。ロレックスは新品279行・未使用品260行が「お問い合わせ」
   （2026-10-17 実測。中古品は362行中329行に価格あり）。
⚠️ 先方の表記どおりに読むため、先方の誤記らしき値もそのまま入る。実例: デイデイト40 228235（BR）の中古品が
   670,000円（同じ表の 228235A は 7,500,000円、他社の 228235 中央値は約536万円）。組み込み時は
   他社中央値との比が極端な値（例: 0.3倍未満・3倍超）を保留にする等のガードを推奨。
- ヴァシュロン・コンスタンタン（/brand/vacheronconstantin/）は価格表なし（0件）。URLS には残している。
"""
from __future__ import annotations

import re
import sys

try:
    from _common import TODAY, norm_ref, pick_ref, run_test, strip_comments, text, yen
except ImportError:  # scripts/ から import された場合
    from shops._common import TODAY, norm_ref, pick_ref, run_test, strip_comments, text, yen

SHOP = "ロデオドライブ"
SHOP_ID = "rodeodrive"
BASE = "https://kaitori.rodeodrive.co.jp/brand/"
URLS = {
    "rolex": BASE + "rolex/",
    "omega": BASE + "omega/",
    "audemarspiguet": BASE + "audemars-piguet/",
    "vacheronconstantin": BASE + "vacheronconstantin/",
    "cartier": BASE + "cartier/",
    "iwc": BASE + "iwc/",
    "panerai": BASE + "panerai/",
    "hublot": BASE + "hublot/",
}
BRANDS = {"rolex": "ロレックス", "omega": "オメガ", "audemarspiguet": "オーデマ・ピゲ",
          "vacheronconstantin": "ヴァシュロン・コンスタンタン", "cartier": "カルティエ",
          "iwc": "IWC", "panerai": "パネライ", "hublot": "ウブロ"}
ENCODING = "utf-8"

COND = {"新品": "新品", "未使用品": "未使用", "中古品": "中古"}


def parse(html: str, url: str) -> list[dict]:
    html = strip_comments(html)
    upd = re.search(r'<time datetime="(\d{4}-\d{2}-\d{2})" class="serv_date"', html)
    page_updated = upd.group(1) if upd else None
    rows: dict[tuple[str, str], dict] = {}
    for tbl in re.findall(r'<table class="serv_tbl[^"]*">([\s\S]*?)</table>', html):
        for tr in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", tbl):
            m_name = re.search(r'<p class="servtbl_ttl">([\s\S]*?)</p>', tr)
            if not m_name:
                continue
            name = text(m_name.group(1))
            tokens = name.split()
            hit = pick_ref(tokens)
            if not hit:
                continue
            i, raw_ref = hit
            ref = norm_ref(raw_ref)
            model = " ".join(tokens[1:i])  # 先頭はブランド名
            tds = re.findall(r"<td[^>]*>([\s\S]*?)</td>", tr)
            dial = text(tds[1]) if len(tds) > 1 else ""
            cells = re.findall(r'<td class="serv_tbl_price fnt_ex02">([\s\S]*?)</td>', tr)
            if not cells:
                continue
            cell = cells[-1]
            labeled = re.findall(r'<span class="serv_tbl_pchide_ttl">([^<]+)</span>([\s\S]*?)</p>', cell)
            pairs = [(COND.get(lbl.strip()), body) for lbl, body in labeled] if labeled else [("中古", cell)]
            for cond, body in pairs:
                if not cond:
                    continue
                v = yen(text(body))
                if not v:
                    continue
                rec = {"shop": SHOP, "shop_id": SHOP_ID, "ref": ref, "model": model, "dial": dial,
                       "price_type": "上限", "condition": cond, "price_jpy": v,
                       "source_url": url, "page_updated": page_updated, "fetched_at": TODAY}
                # 同じ型番が文字盤色ごとに複数行ある → (型番, 状態) ごとに最大額を採る（ウォッチニアンと同じ）
                k = (ref, cond)
                if k not in rows or v > rows[k]["price_jpy"]:
                    rows[k] = rec
    return list(rows.values())


if __name__ == "__main__":
    if "--test" in sys.argv:
        run_test(SHOP_ID, parse, URLS)
    else:
        print(__doc__)
