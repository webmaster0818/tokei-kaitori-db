#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""店の行名と公式スペック（data/specs/）のキーワード照合（案・2026-10-17 jiro-2）。

データは読むだけで、何も書き換えない。日次への組み込みは tomomi-2 が行う。

入力
  data/prices/<日付>.json   … 照合する店のレコード（model・variant・material を店の行名として読む）
  data/watch-master.json    … ブランドの取得（--brand で絞るため）と、--master-names 指定時の代表名
  data/specs/<ref>.json     … 公式の値（movement・caliber・functions・case_material・case_diameter_mm・
                               公式の製品名・出典URL）
  scripts/shops/check-names-allow.json … 表記の違いとして決まったものの例外表

出力
  標準出力に人が読める表。--json <path> で JSON（--json - で標準出力）。
  項目: ref・shop・店の行名・specs の値・不一致の種類・詳細・source_url・レコード数

照合するもの（店の行名に語があるときだけ照合する。語が無いことは不一致にしない）
  ムーブメント  クォーツ／自動巻き／手巻き
  機能          クロノグラフ／GMT／アニュアルカレンダー／ムーンフェイズ（公式側にも名称・機能の記載がある型番だけ）
  素材          SS・ステンレス／イエローゴールド・YG／エバーローズ・ピンク・セドナ・RG／ホワイトゴールド・WG／
                プラチナ／チタン／セラミック／コンビ・ロレゾール・「YG/SS」等の組み合わせ／18K
  ケース径      「42mm」「36.25MM」、ロレックスの「デイトジャスト36」型（±0.6mm まで同じとみなす）
  エディション  ゴルフ／007／スカイフォール／スヌーピー／トリロジー／グッドプラネット

公式側の値の取り方
  - 公式の製品名は sources[].model_source があるファイル（公式ページのタイトル）だけ使う。
    ⚠️ feat/phase2 の data/specs/ は model が店の行名由来の旧版で model_source が無い。その場合 model は使わない。
  - 出典URL（sources[].url）の英字の部分（例 …-annual-calendar-43-mm-…）も公式の名称として使う。

使い方
  python3 scripts/shops/check-names.py                         # data/prices の最新日・全ブランド・全店
  python3 scripts/shops/check-names.py --date 2026-10-17 --brand オメガ --shop ロデオドライブ
  python3 scripts/shops/check-names.py --prices-ref origin/feat/phase2 --specs-ref origin/bot/taro-2/specs
        # ファイルの代わりに git のブランチから読む（作業ツリーにデータが無いとき）
  python3 scripts/shops/check-names.py --json out.json         # JSON も書き出す
  python3 scripts/shops/check-names.py --test                  # 件数・例と、既知の13件の判定を確認
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ALLOW_PATH = Path(__file__).resolve().parent / "check-names-allow.json"


# ---------------------------------------------------------------- 入力（ファイル or git）
class Source:
    """作業ツリーのファイル、または git の ref から読む。"""

    def __init__(self, ref: str | None):
        self.ref = ref

    def read(self, rel: str) -> str | None:
        if self.ref:
            r = subprocess.run(["git", "-C", str(ROOT), "show", f"{self.ref}:{rel}"],
                               capture_output=True)
            return r.stdout.decode("utf-8") if r.returncode == 0 else None
        p = ROOT / rel
        return p.read_text(encoding="utf-8") if p.exists() else None

    def list(self, rel_dir: str) -> list[str]:
        if self.ref:
            r = subprocess.run(["git", "-C", str(ROOT), "ls-tree", "--name-only", f"{self.ref}", rel_dir + "/"],
                               capture_output=True, text=True)
            return [Path(x).name for x in r.stdout.split()] if r.returncode == 0 else []
        p = ROOT / rel_dir
        return sorted(x.name for x in p.iterdir()) if p.exists() else []

    def label(self, rel: str) -> str:
        return f"{self.ref}:{rel}" if self.ref else rel


def spec_file_name(ref: str) -> str:
    return re.sub(r"[^a-z0-9]", "", ref.lower()) + ".json"


# ---------------------------------------------------------------- キーワード
def z2h(s: str) -> str:
    return s.translate(str.maketrans("０１２３４５６７８９ｍＭ．／　", "0123456789mM./ "))


MOVE = {
    "クォーツ": r"クォーツ|クオーツ|QUARTZ|Quartz|quartz|(?<![A-Za-z])QZ(?![A-Za-z])",
    "自動巻き": r"自動巻|オートマチック|オートマティック|Automatic|automatic|AUTOMATIC|Self[\s‑-]?winding|self[\s‑-]?winding",
    "手巻き": r"手巻|Manual[\s‑-]?winding|manual[\s‑-]?winding|Hand[\s‑-]?wound",
}
FUNC = {
    "クロノグラフ": r"クロノグラフ|Chronograph|chronograph|(?<![a-z])chrono(?!meter)",
    "GMT": r"GMT|gmt|Dual Time|dual[\s-]time|デュアルタイム|セカンドタイムゾーン|第2時間帯|第二時間帯|トラベルタイム|Travel Time",
    "アニュアルカレンダー": r"アニュアルカレンダー|年次カレンダー|Annual Calendar|annual[\s-]calendar",
    "ムーンフェイズ": r"ムーンフェイズ|ムーンフェーズ|Moonphase|moonphase|Moon Phase",
}
EDITION = {
    "ゴルフ": r"ゴルフ|Golf|golf",
    "007": r"007",
    "スカイフォール": r"スカイフォール|SKYFALL|Skyfall|skyfall",
    "スヌーピー": r"スヌーピー|Snoopy|snoopy",
    "トリロジー": r"トリロジー|Trilogy|trilogy",
    "グッドプラネット": r"グッドプラネット|GoodPlanet|goodplanet",
}
# 文字盤の色名に含まれる素材語は素材として読まない（例 GINZA RASIN「デイトナ ブラックスチール」）
COLOR_WORDS = r"ブラックスチール|スチールブラック|スチールグレー|スレートスチール|セドナブラック|ゴールデン"
MAT = {
    "SS": r"(?<![A-Za-z])SS(?![A-Za-z])|ステンレス|スチール|Steel|steel|スティール",
    "YG": r"(?<![A-Za-z])YG(?![A-Za-z])|イエローゴールド|Yellow gold|yellow gold|イエローロレゾール",
    "RG": r"(?<![A-Za-z])(?:RG|PG|EG)(?![A-Za-z])|エバーローズ|ローズゴールド|ピンクゴールド|セドナ|Sedna|レッドゴールド|Red gold|red gold|(?<![A-Za-z])Rose|エバーローズロレゾール",
    "WG": r"(?<![A-Za-z])WG(?![A-Za-z])|ホワイトゴールド|White gold|white gold|ホワイトロレゾール|カノープス|Canopus",
    "PT": r"(?<![A-Za-z])PT(?![A-Za-z])|プラチナ|Platinum|platinum|ロレジウム",
    "TI": r"チタン|チタニウム|Titanium|titanium|(?<![A-Za-z])Ti(?![A-Za-z])",
    "CE": r"セラミック|Ceramic|ceramic",
}
GOLD_ANY = r"18K|18Ｋ|K18|(?<!ホワイト)(?<!イエロー)(?<!ピンク)(?<!ローズ)ゴールド(?!ン)|Gold|gold"
COMBI = r"コンビ|ロレゾール|(?<![A-Za-z])(?:YG|RG|WG|PG|PT)\s*[/×xX]\s*SS|SS\s*[/×xX]\s*(?:YG|RG|WG|PG|PT)|Steel\s*[‑-]\s*\w+\s*gold"
DIA_MM = r"(?<![\d.])(\d{2}(?:\.\d{1,2})?)\s*mm(?!\s*[xX×])"
DIA_ROLEX = r"(?:デイトジャスト|ヨットマスター|オイスターパーペチュアル|オイスター パーペチュアル|デイデイト|エクスプローラー|スカイドゥエラー)\s?(\d{2})(?![\dKk.])"


def find(pats: dict[str, str], text: str) -> set[str]:
    return {k for k, p in pats.items() if re.search(p, text)}


def materials(text: str) -> tuple[set[str], bool, bool]:
    """(素材の集合, 組み合わせの記載があるか, 種類不明のゴールドの記載があるか)"""
    t = re.sub(COLOR_WORDS, " ", text)
    m = find(MAT, t)
    # 「エバーローズゴールド」等は RG のみ。GOLD_ANY は具体名のないゴールドだけ拾う
    gold_any = bool(re.search(GOLD_ANY, re.sub(r"イエローゴールド|ホワイトゴールド|ピンクゴールド|ローズゴールド|"
                                               r"エバーローズゴールド|レッドゴールド|セドナゴールド|"
                                               r"Yellow gold|White gold|Red gold|Sedna[^ ]* gold|yellow gold|white gold|red gold", " ", t)))
    combi = bool(re.search(COMBI, t))
    return m, combi, gold_any


def diameters(text: str) -> set[float]:
    t = z2h(text)
    out = {float(x) for x in re.findall(DIA_MM, t, re.I)}
    out |= {float(x) for x in re.findall(DIA_ROLEX, t)}
    return out


# ---------------------------------------------------------------- 公式の値
def spec_view(spec: dict) -> dict:
    src = (spec.get("sources") or [{}])[0]
    official_name = spec.get("model") if src.get("model_source") else None
    url = src.get("url") or ""
    slug = re.sub(r"[-_/]", " ", url.rsplit("/", 1)[-1] if url else "")
    name_text = " ".join(x for x in (official_name or "", slug) if x)
    movement_text = " ".join(str(spec.get(k) or "") for k in ("movement", "winding", "functions"))
    return {
        "official_name": official_name,
        "name_text": name_text,
        "slug": slug,
        "movement_text": movement_text,
        "functions": spec.get("functions"),
        "case_material": spec.get("case_material"),
        "case_diameter_mm": spec.get("case_diameter_mm"),
        "caliber": spec.get("caliber"),
        "source_url": url,
        "archive": src.get("archive"),
    }


def compare(row_text: str, sv: dict) -> list[tuple[str, str]]:
    """(不一致の種類, 詳細) の一覧。"""
    out: list[tuple[str, str]] = []
    all_spec = f"{sv['name_text']} {sv['movement_text']}"

    # ムーブメント
    shop_mv = find(MOVE, row_text)
    spec_mv = find(MOVE, all_spec)
    if shop_mv and spec_mv:
        for k in shop_mv - spec_mv:
            out.append(("ムーブメント", f"店「{k}」／公式「{'・'.join(sorted(spec_mv))}」"))

    # 機能（公式側に名称か機能の記載がある型番だけ。公式名がコレクション名だけの型番は照合できない）
    # 照合できるのは、公式の機能欄があるか、ムーブメント欄に機能名があるか、出典URLが製品名の英字を含む型番
    # （オメガの …-co-axial-chronometer-gmt-43-mm-… 等）。オーデマ ピゲのように公式名がコレクション名だけで
    # URLも型番だけの型番は、機能の記載が無いことを不一致にしない。
    func_known = bool(sv["functions"]) or bool(re.search(r"クロノグラフ|GMT", sv["movement_text"])) or \
        len(re.findall(r"[A-Za-z]{3,}", sv["slug"])) >= 4
    shop_fn = find(FUNC, row_text)
    spec_fn = find(FUNC, all_spec)
    if shop_fn and func_known:
        for k in shop_fn - spec_fn:
            out.append(("機能", f"店「{k}」／公式「{'・'.join(sorted(spec_fn)) or '記載なし'}」"))

    # 素材
    if sv["case_material"]:
        s_mat, s_combi, s_gold = materials(row_text)
        p_mat, p_combi, _ = materials(str(sv["case_material"]))
        p_combi = p_combi or (("SS" in p_mat) and bool(p_mat & {"YG", "RG", "WG", "PT"}))
        p_gold = bool(p_mat & {"YG", "RG", "WG"})
        bad = []
        for k in s_mat - p_mat:
            bad.append(k)
        if s_gold and not p_gold:
            bad.append("ゴールド")
        if s_combi and not p_combi:
            bad.append("コンビ")
        # 店が SS だけを書き、公式がゴールド・プラチナとの組み合わせ（ロレゾール等）
        if s_mat == {"SS"} and not s_combi and not s_gold and p_mat - {"SS"}:
            bad.append("SSのみ")
        if bad:
            out.append(("素材", f"店「{'・'.join(bad)}」／公式「{sv['case_material']}」"))

    # ケース径
    if sv["case_diameter_mm"]:
        d = float(sv["case_diameter_mm"])
        ds = diameters(row_text)
        if ds and not any(abs(x - d) <= 0.6 for x in ds):
            out.append(("ケース径", f"店「{'・'.join(f'{x:g}mm' for x in sorted(ds))}」／公式「{d:g}mm」"))

    # エディション（公式名かURLがある型番だけ）
    if sv["name_text"]:
        for k in find(EDITION, row_text) - find(EDITION, sv["name_text"]):
            out.append(("エディション", f"店「{k}」／公式名・URLに記載なし"))
    return out


# ---------------------------------------------------------------- 例外表
def load_allow() -> list[dict]:
    if not ALLOW_PATH.exists():
        return []
    return json.loads(ALLOW_PATH.read_text(encoding="utf-8")).get("allow", [])


def allowed(item: dict, rules: list[dict]) -> dict | None:
    for r in rules:
        if r.get("ref") and r["ref"] != item["ref"]:
            continue
        if r.get("shop") and r["shop"] != item["shop"]:
            continue
        if r.get("kind") and r["kind"] != item["kind"]:
            continue
        if r.get("detail_contains") and r["detail_contains"] not in item["detail"]:
            continue
        return r
    return None


# ---------------------------------------------------------------- 本体
def row_name(r: dict) -> str:
    """店の行名。model に加え、行の全文を持つ variant（ロデオドライブ・GINZA RASIN・ギャラリーレア）と material。"""
    parts = [r.get("model") or "", r.get("variant") or "", r.get("material") or ""]
    return " ".join(p for p in parts if p).strip()


def run(args) -> dict:
    psrc, ssrc, msrc = Source(args.prices_ref), Source(args.specs_ref), Source(args.master_ref or args.prices_ref)
    dates = sorted(f[:-5] for f in psrc.list("data/prices") if re.match(r"\d{4}-\d{2}-\d{2}\.json$", f))
    if not dates:
        sys.exit(f"data/prices が見つからない（{psrc.label('data/prices')}）")
    date = args.date or dates[-1]
    raw = psrc.read(f"data/prices/{date}.json")
    if raw is None:
        sys.exit(f"{psrc.label(f'data/prices/{date}.json')} が無い")
    records = json.loads(raw).get("records", [])
    master = json.loads(msrc.read("data/watch-master.json") or '{"refs":{}}').get("refs", {})
    spec_names = set(ssrc.list("data/specs"))
    if not spec_names:
        sys.exit(f"data/specs が見つからない（{ssrc.label('data/specs')}）。--specs-ref を指定してください")

    rows: dict[tuple, dict] = {}
    for r in records:
        if r.get("held"):
            continue
        brand = r.get("brand") or master.get(r["ref"], {}).get("brand", "")
        if args.brand and args.brand != brand:
            continue
        if args.shop and args.shop not in (r["shop"], r.get("shop_id")):
            continue
        name = row_name(r)
        if not name:
            continue
        k = (r["ref"], r["shop"], name)
        e = rows.setdefault(k, {"ref": r["ref"], "brand": brand, "shop": r["shop"], "row_name": name,
                                "source_url": r["source_url"], "records": 0})
        e["records"] += 1
    if args.master_names:
        for ref, m in master.items():
            if args.brand and args.brand != m.get("brand"):
                continue
            if m.get("models"):
                rows[(ref, "(マスタ代表名)", m["models"][0])] = {
                    "ref": ref, "brand": m.get("brand", ""), "shop": "(マスタ代表名)", "row_name": m["models"][0],
                    "source_url": "data/watch-master.json", "records": 0}

    rules = load_allow()
    spec_cache: dict[str, dict | None] = {}
    found, allowed_items = [], []
    skipped_rows, skipped_refs = 0, set()
    checked_refs = set()
    for (ref, shop, name), e in sorted(rows.items()):
        fn = spec_file_name(ref)
        if fn not in spec_names:
            skipped_rows += 1
            skipped_refs.add(ref)
            continue
        if ref not in spec_cache:
            spec_cache[ref] = spec_view(json.loads(ssrc.read(f"data/specs/{fn}") or "{}"))
        sv = spec_cache[ref]
        checked_refs.add(ref)
        for kind, detail in compare(name, sv):
            item = {**e, "kind": kind, "detail": detail,
                    "spec": {"official_name": sv["official_name"], "case_material": sv["case_material"],
                             "case_diameter_mm": sv["case_diameter_mm"], "caliber": sv["caliber"],
                             "movement": sv["movement_text"].strip() or None,
                             "official_url": sv["source_url"], "archive": sv["archive"]}}
            rule = allowed(item, rules)
            if rule:
                allowed_items.append({**item, "allow_reason": rule.get("reason")})
            else:
                found.append(item)
    return {"date": date, "prices": psrc.label(f"data/prices/{date}.json"), "specs": ssrc.label("data/specs"),
            "filters": {"brand": args.brand, "shop": args.shop},
            "rows_total": len(rows), "rows_checked": len(rows) - skipped_rows,
            "refs_checked": len(checked_refs),
            "skipped_no_spec": {"rows": skipped_rows, "refs": len(skipped_refs)},
            "mismatches": found, "allowed": allowed_items}


def print_table(res: dict, limit: int | None = None) -> None:
    print(f"# 店の行名と公式スペックの照合 {res['date']}")
    print(f"prices={res['prices']}  specs={res['specs']}  絞り込み={res['filters']}")
    print(f"照合した行 {res['rows_checked']}（{res['refs_checked']}型番）／specs が無く飛ばした行 "
          f"{res['skipped_no_spec']['rows']}（{res['skipped_no_spec']['refs']}型番）")
    ms = res["mismatches"]
    print(f"不一致 {len(ms)}件（{len({(m['ref'], m['shop'], m['row_name']) for m in ms})}行）／例外表で許可 {len(res['allowed'])}件")
    print("種類別: " + "、".join(f"{k} {v}" for k, v in Counter(m["kind"] for m in ms).most_common()))
    print("店別: " + "、".join(f"{k} {v}" for k, v in Counter(m["shop"] for m in ms).most_common()))
    print()
    print("| ref | shop | 店の行名 | 不一致の種類 | 詳細 | source_url |")
    print("|---|---|---|---|---|---|")
    for m in ms[:limit] if limit else ms:
        print(f"| {m['ref']} | {m['shop']} | {m['row_name']} | {m['kind']} | {m['detail']} | {m['source_url']} |")
    if limit and len(ms) > limit:
        print(f"（ほか {len(ms) - limit}件）")
    if res["allowed"]:
        print("\n例外表で許可した不一致:")
        for m in res["allowed"]:
            print(f"- {m['ref']} {m['shop']} 「{m['row_name']}」 {m['kind']} {m['detail']}（{m['allow_reason']}）")


# ---------------------------------------------------------------- --test
# 2026-10-17 の調査（master-mismatch.md）で確定した4件は検出されること、保留9件は検出されないこと
EXPECT_HIT = [
    ("123.10.35.60.01.001", "クォーク", "ムーブメント"),
    ("126503", "ジャックロード", "素材"),
    ("231.10.42.21.02.002", "ロデオドライブ", "エディション"),
    ("231.10.42.21.02.002", "GINZA RASIN", "エディション"),
    ("231.10.42.21.02.002", "なんぼや", "エディション"),
    ("231.10.43.22.02.001", "ロデオドライブ", "機能"),
    ("231.10.43.22.02.001", "なんぼや", "機能"),
]
EXPECT_NO_HIT = [  # (ref, shop, 理由)
    ("126234", "大黒屋", "例外表（ホワイトロレゾールの SS 表記・2026-10-17 表記の違いと決定）"),
    ("126334", "大黒屋", "例外表（同上）"),
    ("210.30.42.20.06.001", "大黒屋", "行名が空欄"),
    ("310.32.42.50.02.001", "GINZA RASIN", "文字盤色は照合しない（文字盤の対応表で別扱い）"),
    ("311.63.44.51.99.001", "ウォッチニアン", "「ムーンウォッチ」は照合語ではない"),
    ("311.90.44.51.03.001", "ウォッチニアン", "同上"),
    ("311.92.44.30.01.001", "ウォッチニアン", "同上"),
    ("311.92.44.51.01.005", "ウォッチニアン", "同上"),
    ("311.92.44.51.01.006", "ウォッチニアン", "同上"),
]


def self_test(res: dict) -> bool:
    ok = True
    hits = {(m["ref"], m["shop"], m["kind"]) for m in res["mismatches"]}
    allowed_keys = {(m["ref"], m["shop"]) for m in res["allowed"]}
    print("\n## 既知の4件（検出されること）")
    for k in EXPECT_HIT:
        r = k in hits
        ok &= r
        print(f"- {'OK' if r else 'NG'} {k[0]} {k[1]} {k[2]}")
    print("\n## 保留9件（不一致として出ないこと）")
    for ref, shop, why in EXPECT_NO_HIT:
        bad = [m for m in res["mismatches"] if m["ref"] == ref and m["shop"] == shop]
        r = not bad
        ok &= r
        extra = "（例外表で許可）" if (ref, shop) in allowed_keys else ""
        print(f"- {'OK' if r else 'NG'} {ref} {shop}: {why}{extra}" + (f" → 検出: {bad[0]['detail']}" if bad else ""))
    for ref in ("126234", "126334"):
        r = (ref, "大黒屋") in allowed_keys
        ok &= r
        print(f"- {'OK' if r else 'NG'} {ref} 大黒屋 が例外表で許可されていること")
    print(f"\n結果: {'すべて OK' if ok else 'NG あり'}")
    return ok


def main() -> None:
    ap = argparse.ArgumentParser(description="店の行名と公式スペックのキーワード照合（読み取りのみ）")
    ap.add_argument("--date", help="照合する日（data/prices/<日付>.json）。省略時は最新")
    ap.add_argument("--brand", help="ブランドで絞る（例 オメガ）")
    ap.add_argument("--shop", help="店で絞る（店名 または shop_id）")
    ap.add_argument("--prices-ref", help="data/prices と data/watch-master.json を読む git ref（省略時は作業ツリー）")
    ap.add_argument("--master-ref", help="data/watch-master.json だけ別の git ref から読む")
    ap.add_argument("--specs-ref", help="data/specs を読む git ref（省略時は作業ツリー）")
    ap.add_argument("--master-names", action="store_true", help="マスタの代表名（models[0]）も照合する")
    ap.add_argument("--json", help="JSON の出力先（- で標準出力）")
    ap.add_argument("--limit", type=int, help="表に出す件数の上限")
    ap.add_argument("--test", action="store_true", help="件数と例を出し、既知の13件の判定を確認する")
    args = ap.parse_args()
    if args.test:
        # 作業ツリーに 8社分の価格・公式の specs が無いときは、調査に使ったブランチから読む
        if not args.prices_ref and not (ROOT / "data" / "specs").exists():
            args.prices_ref = "origin/feat/phase2"
        if not args.specs_ref and not (ROOT / "data" / "specs").exists():
            args.specs_ref = "origin/bot/taro-2/specs"
    res = run(args)
    if args.json:
        s = json.dumps(res, ensure_ascii=False, indent=1)
        if args.json == "-":
            print(s)
            return
        Path(args.json).write_text(s, encoding="utf-8")
    print_table(res, limit=(args.limit or (15 if args.test else None)))
    if args.test:
        sys.exit(0 if self_test(res) else 1)


if __name__ == "__main__":
    main()
