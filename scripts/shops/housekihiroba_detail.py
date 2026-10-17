#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""宝石広場（株式会社ユーズカンパニー）の商品詳細ページ。状態別の買取価格と更新日を取る。調査 2026-10-17。

★ 2026-10-17 tomomi-2 判断: 宝石広場は保留（MediaXAI の判断待ち）。日次・週次への組み込みは判断が出てから。

取得元: https://www.housekihiroba-kaitori.jp/watch_product/<管理NO>
- robots.txt・規約の確認結果は housekihiroba.py の冒頭を参照（/watch_product/ も許可パス）。
- 取得対象は housekihiroba_detail_urls.tsv（現行の型番マスタと一致する型番の詳細URL）。週1回の取得を想定。
  1.5秒間隔で約17分。同じ店へ並列で投げないこと。
- 一覧（/watch_brand/）の額は詳細の先頭の額で、未使用品と中古品が混ざっている（housekihiroba.py 参照）。
  詳細ページには状態ごとの額と更新日がある:
    <dl class="single_item_info__price__detail">
      <dt>買取価格（未使用品）：</dt>
      <dd><span class="red_text"> 〜2,300,000 </span>円<br><span …update_date">更新日：2026-03-02</span></dd>
      <dt>買取価格（中古品）：</dt>
      <dd><span class="red_text"> 〜2,100,000 </span>円<br><span …update_date">更新日：2026-08-25</span></dd>
    </dl>
  型番・色・材質名は仕様表 <ul id="model_spec"> から読む。
- price_type: 「〜」付き → 上限。condition: 未使用品→未使用 / 中古品→中古。page_updated: その額の更新日。
⚠️ 更新日は額ごとに違い、数か月更新されていない額がある（実測: 126610LN の未使用品は 2026-03-02）。
   parse(..., max_age_months=3) で「更新日が取得日から3か月以内の額だけ」に絞れる（更新日が無い額も落とす）。
   既定（None）は絞らない。
⚠️ 同じ型番に文字盤・素材違いの詳細ページが複数ある。1ページ＝1商品。parse() はまとめない。
   型番×状態の最大額が必要なときだけ merge_max() を使う（2026-10-17 の方針では使わない）。
- 行の区別: dial＝仕様表の「色」、material＝「材質名」、variant＝「管理NO」の表記（例「管理NO RX2950」）。
⚠️ 価格が「お問い合わせ」の状態は飛ばす（0円にしない）。

使い方:
  python3 scripts/shops/housekihiroba_detail.py --test            サンプル2本をパース（絞り込みなし／3か月以内の両方）
  python3 scripts/shops/housekihiroba_detail.py --build-urls 一覧HTML…
      一覧ページ（/watch_brand/<id> を保存したもの。ファイル名はURLSのキー）から、
      data/watch-master.json の型番と一致する詳細URLを housekihiroba_detail_urls.tsv に書き出す。

★ 2026-10-17 方針変更（tomomi-2）: 同じ型番の行を最大額にまとめず、表の行をすべて返す。
  各行を区別する文言は店の表記のまま dial / material / variant に入れる（推測で補わない。無ければ空欄）。
  ★ variant は PriceRecord に無いキーで、このとき追加した（行を区別する店の表記をそのまま入れる）。
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    from _common import HERE, TODAY, norm_ref, run_test, strip_comments, text, yen
except ImportError:
    from shops._common import HERE, TODAY, norm_ref, run_test, strip_comments, text, yen

SHOP = "宝石広場"
SHOP_ID = "housekihiroba"
SITE = "https://www.housekihiroba-kaitori.jp"
URL_LIST = HERE / "housekihiroba_detail_urls.tsv"
SAMPLE_URLS = {
    "rx2950": SITE + "/watch_product/rx2950",  # 126610LN（未使用品・中古品の2価格、更新日が別）
    "rx2506": SITE + "/watch_product/rx2506",  # 116508NG（中古品のみ）
}

DETAIL_PRICE = re.compile(r"<dt>買取価格（(未使用品|中古品)）：</dt>\s*<dd>([\s\S]*?)</dd>")


def load_urls() -> list[tuple[str, str]]:
    """housekihiroba_detail_urls.tsv → [(型番, 詳細URL), …]"""
    out = []
    for line in URL_LIST.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            ref, url = line.split("\t")[:2]
            out.append((ref, url))
    return out


URLS = [u for _, u in load_urls()] if URL_LIST.exists() else []


def _months_before(d: date, n: int) -> date:
    idx = d.year * 12 + (d.month - 1) - n
    y, m = divmod(idx, 12)
    m += 1
    # 月末の調整（例: 5/31 の3か月前 → 2/28）
    for day in (d.day, 30, 29, 28):
        try:
            return date(y, m, day)
        except ValueError:
            continue
    return date(y, m, 28)


def parse(html: str, url: str, max_age_months: int | None = None, today: str | None = None) -> list[dict]:
    """詳細ページ1枚 → 状態ごとのレコード。

    max_age_months を指定すると、更新日が取得日（today、既定は実行日）から その月数以内の額だけ返す。
    """
    fetched = today or TODAY
    html = strip_comments(html)
    spec_m = re.search(r'<ul id="model_spec">([\s\S]*?)</ul>', html)
    spec = dict((text(k), text(v)) for k, v in re.findall(
        r"<li>\s*<div>([^<]+)</div>\s*<div>([\s\S]*?)</div>\s*</li>", spec_m.group(1) if spec_m else ""))
    if not spec.get("型番"):
        return []
    ref = norm_ref(spec["型番"])
    title = re.search(r'<h2 class="pph_main_title">([^<]+?)\s*[A-Za-z0-9./-]+の買取金額推移</h2>', html)
    model = text(title.group(1)) if title else ""
    floor = _months_before(date.fromisoformat(fetched), max_age_months) if max_age_months else None
    out = []
    for cond, dd in DETAIL_PRICE.findall(html):
        pm = re.search(r'<span class="red_text">([^<]*)</span>', dd)
        if not pm:
            continue
        v = yen(pm.group(1))
        if not v:
            continue
        um = re.search(r"更新日：(\d{4}-\d{2}-\d{2})", dd)
        upd = um.group(1) if um else None
        if floor and (not upd or date.fromisoformat(upd) < floor):
            continue
        out.append({"shop": SHOP, "shop_id": SHOP_ID, "ref": ref, "model": model,
                    "dial": spec.get("色", ""), "material": spec.get("材質名", ""),
                    "variant": f"管理NO {spec['管理NO']}" if spec.get("管理NO") else "",
                    "price_type": "上限" if ("〜" in pm.group(1) or "～" in pm.group(1)) else "通常",
                    "condition": "未使用" if cond == "未使用品" else "中古", "price_jpy": v,
                    "source_url": url, "page_updated": upd, "fetched_at": fetched})
    return out


def merge_max(records: list[dict]) -> list[dict]:
    """複数の詳細ページのレコードを (型番, 状態) ごとに最大額の1件にまとめる。"""
    best: dict[tuple[str, str], dict] = {}
    for r in records:
        k = (r["ref"], r["condition"])
        if k not in best or r["price_jpy"] > best[k]["price_jpy"]:
            best[k] = r
    return list(best.values())


def build_urls(list_files: list[str]) -> None:
    """一覧ページの保存HTMLから、型番マスタと一致する詳細URLを TSV に書く。"""
    from housekihiroba import detail_urls  # 一覧のカードから型番と詳細URLを取る
    master = json.loads((HERE.parents[1] / "data" / "watch-master.json").read_text(encoding="utf-8"))["refs"]
    rows: list[tuple[str, str]] = []
    for f in list_files:
        for ref, urls in detail_urls(Path(f).read_text(encoding="utf-8")).items():
            if ref in master:
                rows += [(ref, u) for u in urls]
    rows = sorted(set(rows))
    head = (f"# 宝石広場 詳細URL（型番マスタと一致する型番のみ）。生成 {TODAY}。"
            f"{len({r for r, _ in rows})}型番 / {len(rows)}URL。列: 型番<TAB>URL\n")
    URL_LIST.write_text(head + "".join(f"{r}\t{u}\n" for r, u in rows), encoding="utf-8")
    print(f"{URL_LIST.name}: {len({r for r, _ in rows})}型番 / {len(rows)}URL")


if __name__ == "__main__":
    if "--build-urls" in sys.argv:
        build_urls([a for a in sys.argv[1:] if a != "--build-urls"])
    elif "--test" in sys.argv:
        # サンプルの取得日（2026-10-17）を基準に絞り込みも試す
        print("== 絞り込みなし")
        run_test(SHOP_ID, parse, SAMPLE_URLS, sample_dir="housekihiroba_detail")
        print("\n== 更新日が取得日から3か月以内の額のみ（max_age_months=3, today=2026-10-17）")
        run_test(SHOP_ID, lambda h, u: parse(h, u, max_age_months=3, today="2026-10-17"),
                 SAMPLE_URLS, sample_dir="housekihiroba_detail")
        print(f"\n取得対象URL: {len(URLS)}件（{URL_LIST.name}）")
    else:
        print(__doc__)
