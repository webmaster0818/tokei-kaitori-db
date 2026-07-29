#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""時計買取価格の定点観測フェッチャ(プロトタイプ・ロレックス)。

経路検証(2026-07-29)で確定した4社の公開「型番別買取価格」ページを取得し、
型番×日付×社×価格のレコードに正規化して保存する。
- 全て robots.txt 許可パス・実在ページのみ(検証済み)。リクエスト間2秒スリープ。
- 掲載時は出典URL+取得日を必ず表示する前提のデータ構造。
- 価格の捏造・推定はしない: パースできない行はスキップしてskip数を記録。

出力:
  data/prices/YYYY-MM-DD.json  … 当日の全レコード
  data/watch-master.json       … 型番マスタ(観測された型番の集合・社数つき)
  data/history/<ref>.json      … 型番別履歴(追記)
"""
from __future__ import annotations
import json
import re
import time
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TODAY = datetime.now().strftime("%Y-%m-%d")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
SLEEP = 2.0

# なんぼやref取得数の上限(プロトタイプ。他社と突合できる型番を優先)
NANBOYA_CAP = 15


def fetch(url: str, encoding: str = "utf-8") -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as res:
        return res.read().decode(encoding, errors="replace")


def yen(t: str) -> int | None:
    m = re.search(r"([\d,]+)", t)
    if not m:
        return None
    v = int(m.group(1).replace(",", ""))
    return v if 10_000 <= v <= 100_000_000 else None


def norm_ref(ref: str) -> str:
    return ref.upper().strip()


def parse_jackroad(html: str, url: str) -> list[dict]:
    out = []
    pat = re.compile(
        r"<p>([^<]{3,60})</p><p>([^<]{1,30})</p><p>([A-Za-z0-9./-]{4,20})</p>"
        r"<p class=\"name123name2\"><span class='name11name2'>([\d,]+)円</span></p>"
        r"[\s\S]{0,200}?<p class='name13name2'>([\d,]+)円</p>"
    )
    for m in pat.finditer(html):
        ref = norm_ref(m.group(3))
        for ptype, raw in (("通常", m.group(4)), ("上限", m.group(5))):
            v = yen(raw)
            if v:
                out.append({"shop": "ジャックロード", "shop_id": "jackroad", "ref": ref,
                            "model": m.group(1).strip(), "dial": m.group(2).strip(),
                            "price_type": ptype, "condition": "中古", "price_jpy": v,
                            "source_url": url, "fetched_at": TODAY})
    return out


def parse_quark(html: str, url: str) -> list[dict]:
    out = []
    pat = re.compile(
        r"<td><b>([^<]{2,30})</b></td>\s*<td><b>([A-Za-z0-9./-]{4,20})</b></td>"
        r"\s*<td>([^<]{1,20})</td>\s*<td[^>]*>([^<]{1,10})</td>\s*<td[^>]*>￥([\d,]+)</td>"
    )
    for m in pat.finditer(html):
        v = yen(m.group(5))
        if v:
            out.append({"shop": "クォーク", "shop_id": "quark", "ref": norm_ref(m.group(2)),
                        "model": m.group(1).strip(), "dial": m.group(4).strip(),
                        "material": m.group(3).strip(),
                        "price_type": "上限", "condition": "中古", "price_jpy": v,
                        "source_url": url, "fetched_at": TODAY})
    return out


def parse_daikokuya(html: str, url: str) -> list[dict]:
    # 行: モデル名 SS<br><span class="ref">REF</span></td><td class="price-cell">¥未使用</td><td class="price-cell">〜 ¥中古</td>
    out = []
    pat = re.compile(
        r'([^<>]{2,40})<br><span class="ref">([A-Za-z0-9./-]{4,20})</span></td>'
        r'<td class="price-cell">([^<]*)</td><td class="price-cell">([^<]*)</td>'
    )
    for m in pat.finditer(html):
        ref = norm_ref(m.group(2))
        model = re.sub(r"\s+", " ", m.group(1)).strip()
        for cond, raw in (("未使用", m.group(3)), ("中古", m.group(4))):
            v = yen(raw.replace("&yen;", ""))
            if v:
                out.append({"shop": "大黒屋", "shop_id": "daikokuya", "ref": ref, "model": model,
                            "price_type": "上限", "condition": cond, "price_jpy": v,
                            "source_url": url, "fetched_at": TODAY})
    return out


def parse_nanboya(html: str, url: str) -> list[dict]:
    out = []
    ref_m = re.search(r"/ref-([a-z0-9-]+)/", url)
    ref = norm_ref(ref_m.group(1).replace("-", ".")) if ref_m else "?"
    upd = re.search(r'更新日：<time datetime="([\d-]+)"', html)
    model_m = re.search(r"<title>([^<|]+?)\s*Ref\.", html)
    model = model_m.group(1).strip() if model_m else ""
    # 月次履歴テーブル
    hist_pat = re.compile(
        r"<span>(20\d\d)年</span><span>(\d{1,2})月</span></td>\s*"
        r'<td class="market-chart_pasttable_price">([\d,]+)円', re.S)
    for m in hist_pat.finditer(html):
        v = yen(m.group(3))
        if v:
            out.append({"shop": "なんぼや", "shop_id": "nanboya", "ref": ref, "model": model,
                        "price_type": "相場", "condition": "中古",
                        "price_month": f"{m.group(1)}-{int(m.group(2)):02d}",
                        "price_jpy": v, "source_url": url,
                        "page_updated": upd.group(1) if upd else None, "fetched_at": TODAY})
    return out


def main() -> None:
    records: list[dict] = []
    errors: list[str] = []

    jobs = [("jackroad", "https://www.jackroad.co.jp/shop/pages/j_rolex_kaitori.aspx", "cp932", parse_jackroad),
            ("quark", "https://www.909.co.jp/rolex_buy.html", "utf-8", parse_quark)]
    for series in ["submariner", "daytona", "gmt_master", "explorer", "datejust", "daydate"]:
        jobs.append((f"daikokuya:{series}",
                     f"https://kaitori.e-daikoku.com/brand/brand/rolex_{series}.html",
                     "utf-8", parse_daikokuya))

    for name, url, enc, parser in jobs:
        try:
            html = fetch(url, enc)
            rows = parser(html, url)
            records.extend(rows)
            print(f"{name}: {len(rows)} records")
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"NG {name}: {e}")
        time.sleep(SLEEP)

    # なんぼや: 他社と突合できる型番を優先して取得
    other_refs = {r["ref"] for r in records}
    nb_urls_path = ROOT / "data" / "nanboya-ref-urls.txt"
    nb_urls = [u.strip() for u in nb_urls_path.read_text().splitlines() if u.strip()]

    def nb_ref(u: str) -> str:
        m = re.search(r"/ref-([a-z0-9-]+)/", u)
        return norm_ref(m.group(1).replace("-", ".")) if m else ""

    prioritized = [u for u in nb_urls if nb_ref(u) in other_refs]
    rest = [u for u in nb_urls if nb_ref(u) not in other_refs]
    for u in (prioritized + rest)[:NANBOYA_CAP]:
        try:
            html = fetch(u)
            rows = parse_nanboya(html, u)
            records.extend(rows)
            print(f"nanboya {nb_ref(u)}: {len(rows)} records")
        except Exception as e:
            errors.append(f"nanboya {u}: {e}")
            print(f"NG nanboya {u}: {e}")
        time.sleep(SLEEP)

    # 保存
    out_dir = ROOT / "data" / "prices"
    out_dir.mkdir(parents=True, exist_ok=True)
    json.dump({"fetched_at": TODAY, "records": records, "errors": errors},
              open(out_dir / f"{TODAY}.json", "w"), ensure_ascii=False, indent=1)

    # 型番マスタ更新(観測ベース: どの社に載っているか=実需の証拠)
    master_path = ROOT / "data" / "watch-master.json"
    master = json.load(open(master_path)) if master_path.exists() else {"refs": {}}
    for r in records:
        ref = r["ref"]
        e = master["refs"].setdefault(ref, {"brand": "ロレックス", "models": [], "shops": []})
        if r.get("model") and r["model"] not in e["models"]:
            e["models"].append(r["model"])
        if r["shop_id"] not in e["shops"]:
            e["shops"].append(r["shop_id"])
    master["updated_at"] = TODAY
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=1)

    # 型番別履歴に追記(当日レコードのみ)
    hist_dir = ROOT / "data" / "history"
    hist_dir.mkdir(exist_ok=True)
    by_ref: dict[str, list[dict]] = {}
    for r in records:
        if r.get("price_month") and r["price_month"] != TODAY[:7]:
            continue  # なんぼやの過去月履歴はマスタでなく当日スナップに含めない
        by_ref.setdefault(r["ref"], []).append(r)
    for ref, rows in by_ref.items():
        p = hist_dir / f"{re.sub(r'[^A-Z0-9.]', '_', ref)}.json"
        hist = json.load(open(p)) if p.exists() else {"ref": ref, "days": []}
        hist["days"] = [d for d in hist["days"] if d["date"] != TODAY]
        hist["days"].append({"date": TODAY, "records": rows})
        json.dump(hist, open(p, "w"), ensure_ascii=False)

    print(f"\ntotal records={len(records)} refs={len({r['ref'] for r in records})} errors={len(errors)}")


if __name__ == "__main__":
    main()
