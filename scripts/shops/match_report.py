#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""候補店のレコードを、現行データ（data/watch-master.json と最新の data/prices/*.json）と突合する。

使い方:
  python3 scripts/shops/match_report.py parsed_rodeodrive.json parsed_piazo.json ...
  （各 JSON は parse() が返したレコードの配列。brand キーがあればブランド別の内訳も出す）

数え方:
- 「公開中」= 現行で2社以上の価格がある型番（lib/prices.ts の publishableRefs と同じ条件。
  月次公開のなんぼやは型番×店ごとに最新月、最新月から3か月より古い月は除く＝currentRecords と同じ）。
- 「1社だけ」= 現行で1社しか価格が無い型番。
- 突合キーは大文字化して英数字以外を除いたもの（_common.match_key）。
- 「新たに2社以上」= 1社だけの型番のうち候補店にもある型番（その店1社を足した場合）。
  まとめて足した場合は、これに「マスタに無い（または0社の）型番で、候補店どうしで2社以上になる型番」を加える。
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import match_key  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
STALE_MONTHS = 3


def months_before(month: str, n: int) -> str:
    y, m = map(int, month.split("-"))
    idx = y * 12 + (m - 1) - n
    return f"{idx // 12}-{idx % 12 + 1:02d}"


def current_state():
    snap = sorted((ROOT / "data" / "prices").glob("*.json"))[-1]
    recs = [r for r in json.loads(snap.read_text(encoding="utf-8"))["records"] if not r.get("held")]  # 外れ値の保留分は公開に使わない
    months = [r["price_month"] for r in recs if r.get("price_month")]
    floor = months_before(max(months), STALE_MONTHS) if months else ""
    picked: dict[tuple[str, str], str] = {}
    for r in recs:
        if r.get("price_month") and r["price_month"] >= floor:
            k = (r["ref"], r["shop"])
            picked[k] = max(picked.get(k, ""), r["price_month"])
    cur = [r for r in recs if not r.get("price_month") or picked.get((r["ref"], r["shop"])) == r["price_month"]]
    master = json.loads((ROOT / "data" / "watch-master.json").read_text(encoding="utf-8"))["refs"]
    shops = defaultdict(set)
    for r in cur:
        shops[r["ref"]].add(r["shop"])
    by_key = {match_key(k): k for k in master}
    n_shops = {match_key(k): len(shops.get(k, ())) for k in master}
    return snap.name, master, by_key, n_shops


def main(paths: list[str]) -> None:
    snap, master, by_key, n_shops = current_state()
    pub = {k for k, n in n_shops.items() if n >= 2}
    single = {k for k, n in n_shops.items() if n == 1}
    print(f"現行: {snap} / マスタ {len(master)}型番 / 公開中(2社以上) {len(pub)} / 1社だけ {len(single)}\n")
    shop_keys: dict[str, set[str]] = {}
    for p in paths:
        recs = json.loads(Path(p).read_text(encoding="utf-8"))
        sid = recs[0]["shop_id"] if recs else Path(p).stem
        keys = {match_key(r["ref"]) for r in recs}
        shop_keys[sid] = keys
        hit_pub, hit_single = keys & pub, keys & single
        print(f"[{sid}] {len(recs)}レコード / {len(keys)}型番 / 公開中と一致 {len(hit_pub)} / "
              f"1社だけと一致 {len(hit_single)} → 新たに2社以上 {len(hit_single)}")
        brand_of = {match_key(r["ref"]): r.get("brand", "?") for r in recs}
        c_all, c_pub, c_single = Counter(), Counter(), Counter()
        for k in keys:
            b = brand_of[k]
            c_all[b] += 1
            c_pub[b] += k in pub
            c_single[b] += k in single
        for b in c_all:
            print(f"    {b}: {c_all[b]}型番 / 公開中一致 {c_pub[b]} / 1社だけ一致 {c_single[b]}")
    # まとめて追加した場合
    cnt = Counter(k for ks in shop_keys.values() for k in ks)
    new_from_single = {k for k in single if cnt[k] >= 1}
    new_brand_new = {k for k, c in cnt.items() if n_shops.get(k, 0) == 0 and c >= 2}
    print(f"\n[まとめて追加] 1社だけ→2社以上: {len(new_from_single)} / "
          f"マスタに無い・0社の型番で候補店どうし2社以上: {len(new_brand_new)} / "
          f"合計 新たに公開可能 {len(new_from_single) + len(new_brand_new)}")
    print(f"    （1社だけの型番 {len(single)} のうち、どの候補店にも無いもの {len(single - new_from_single)}）")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1:])
