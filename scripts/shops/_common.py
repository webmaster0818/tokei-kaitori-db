# -*- coding: utf-8 -*-
"""scripts/shops/ の各パーサで共有する小道具。

- norm_ref / yen は scripts/fetch-watch-prices.py と同じ規則にそろえている
  （組み込み時に本体側の関数へ差し替えても結果が変わらないように）。
- run_test() は `python3 scripts/shops/<shop_id>.py --test` の共通処理。
  samples/<shop_id>/ の HTML をパースし、レコード数・型番数と先頭5件を出す。
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

TODAY = datetime.now().strftime("%Y-%m-%d")
HERE = Path(__file__).resolve().parent


def norm_ref(ref: str) -> str:
    """fetch-watch-prices.py の norm_ref と同じ（区切り記号をドットに寄せて大文字化）。"""
    return re.sub(r"[./-]+", ".", ref.strip()).upper()


def match_key(ref: str) -> str:
    """他社との突合用キー。大文字化して英数字以外を除く（指示書の比較規則）。"""
    return re.sub(r"[^A-Z0-9]", "", ref.upper())


def yen(t: str) -> int | None:
    m = re.search(r"([\d,]+)", t)
    if not m:
        return None
    v = int(m.group(1).replace(",", ""))
    return v if 10_000 <= v <= 100_000_000 else None


def strip_comments(html: str) -> str:
    """HTML コメントを除く。コメントアウトされた旧価格（GINZA RASIN の souba_price1 等）を拾わないため。"""
    return re.sub(r"<!--[\s\S]*?-->", "", html)


def text(fragment: str) -> str:
    t = re.sub(r"<[^>]+>", " ", fragment)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", t).strip()


REF_TOKEN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9./-]{3,}$")


def pick_ref(tokens: list[str]) -> tuple[int, str] | None:
    """名前のトークン列から型番らしいもの（英数字・記号のみ・数字を含む・4文字以上）を後ろから探す。"""
    for i in range(len(tokens) - 1, -1, -1):
        t = tokens[i]
        if REF_TOKEN.match(t) and re.search(r"\d{3,}", t):
            return i, t
    return None


def run_test(shop_id: str, parse, urls: dict[str, str], sample_dir: str | None = None) -> None:
    """samples/<shop_id>/*.html を parse し、件数と先頭5件を表示する。

    サンプルのファイル名（拡張子なし）は URLS のキーと同じにしてあり、source_url はそこから引く。
    """
    sdir = HERE / "samples" / (sample_dir or shop_id)
    files = sorted(sdir.glob("*.html"))
    if not files:
        sys.exit(f"サンプルがありません: {sdir}")
    total: list[dict] = []
    for f in files:
        url = urls.get(f.stem, f"sample://{shop_id}/{f.name}")
        rows = parse(f.read_text(encoding="utf-8"), url)
        print(f"{f.name}: {len(rows)} records / {len({r['ref'] for r in rows})} refs  ({url})")
        total.extend(rows)
    print(f"合計: {len(total)} records / {len({r['ref'] for r in total})} refs")
    for r in total[:5]:
        print(json.dumps(r, ensure_ascii=False))
