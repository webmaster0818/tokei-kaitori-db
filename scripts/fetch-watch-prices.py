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

# なんぼやref取得数の上限。なんぼやは1URL=1型番なので、
# 取得数がそのまま「2社以上そろう型番＝公開できるページ」の上限になる。
# 小さすぎると tier1（既存公開ページの維持）だけで枠を使い切り、新規が1件も増えない。
# オメガ163件を追加した結果、tier1（既存公開ページの維持）とtier2（新たに2社目になれる型番）を
# 取り切るのに40では足りなくなったので引き上げた。320件×2秒＝約11分。
NANBOYA_CAP = 320


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
    """型番の表記ゆれをそろえる。

    ⚠️ 区切り記号は店によって違う。同じ時計が別型番として扱われる原因になる。
        大黒屋   4500V/110A-B126
        なんぼや  4500V.110A.B126   ← URL由来
       実測で、ヴァシュロン16型番が「共通ゼロ」に見えていたのはこれが理由だった。
       スラッシュ・ハイフンをドットに寄せて比較できるようにする。
       （ロレックスは区切りなし、オメガ/APはもともとドットなので影響しない）
    """
    return re.sub(r"[./-]+", ".", ref.strip()).upper()


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
    """大黒屋の買取価格表。1行 = 1型番（未使用/中古の2価格）。

    ⚠️ 単一の巨大な正規表現で通していたら datejust/daydate が0件だった。原因は2つ:
      1. デイトジャストは型番のあとに文字盤色が入る
         <span class="ref">126300</span><br><span class="end">アズーロブルー</span>
         → 「refの直後に</td>」を前提にしていたため全滅（89型番を取り逃していた）
      2. デイデイトは価格セルの中身が「お問い合わせ」リンクで、価格が存在しない
         → [^<]* ではタグを含むセルにマッチできない

    そのため <tr> 単位に分割してから項目を拾う方式に変えた。
    文字盤色は捨てずに dial として持つ（他社と粒度を揃えるため）。
    """
    out = []
    row_pat = re.compile(r"<tr[^>]*>([\s\S]*?)</tr>", re.I)
    ref_pat = re.compile(r'<span class="ref">([A-Za-z0-9./-]{4,20})</span>')
    name_pat = re.compile(r'<td class="item-name">([^<]{2,40})<br>')
    dial_pat = re.compile(r'<span class="end">([^<]{1,30})</span>')
    cell_pat = re.compile(r'<td class="price-cell">([\s\S]*?)</td>', re.I)

    for row in row_pat.findall(html):
        m_ref = ref_pat.search(row)
        if not m_ref:
            continue
        ref = norm_ref(m_ref.group(1))
        m_name = name_pat.search(row)
        model = re.sub(r"\s+", " ", m_name.group(1)).strip() if m_name else ""
        m_dial = dial_pat.search(row)
        dial = m_dial.group(1).strip() if m_dial else None

        cells = cell_pat.findall(row)[:2]
        for cond, raw in zip(("未使用", "中古"), cells):
            # 「お問い合わせ」等、価格が掲載されていないセルは黙って飛ばす（0円にしない）
            v = yen(re.sub(r"<[^>]+>", " ", raw).replace("&yen;", ""))
            if v:
                rec = {"shop": "大黒屋", "shop_id": "daikokuya", "ref": ref, "model": model,
                       "price_type": "上限", "condition": cond, "price_jpy": v,
                       "source_url": url, "fetched_at": TODAY}
                if dial:
                    rec["dial"] = dial
                out.append(rec)
    return out

def nanboya_ref(url: str) -> str:
    """なんぼやの型番URLから型番を取り出す。

    ⚠️ ブランドによってURLの形が違う:
        ロレックス .../rolex/air-king/ref-114210/
        オメガ     .../omega/speedmaster/311-30-42-30-01-006/   ← ref- が付かない
    """
    m = re.search(r"/([a-z0-9-]+)/$", url)
    if not m:
        return ""
    seg = m.group(1)
    seg = seg[4:] if seg.startswith("ref-") else seg
    return norm_ref(seg.replace("-", "."))


def nanboya_brand(url: str) -> str:
    m = re.search(r"/price-list/([a-z-]+)/", url)
    return {"rolex": "ロレックス", "omega": "オメガ",
            "audemarspiguet": "オーデマ・ピゲ",
            "vacheron-constantin": "ヴァシュロン・コンスタンタン"}.get(m.group(1) if m else "", "")


def parse_nanboya(html: str, url: str) -> list[dict]:
    out = []
    ref = nanboya_ref(url) or "?"
    upd = re.search(r'更新日：<time datetime="([\d-]+)"', html)
    # タイトル例: 「オメガ スピードマスター プロフェッショナル 311.30.42.30.01.006 買取価格相場」
    #             「ロレックス エアキング Ref.114210 買取価格相場」
    # 型番の直前までがモデル名。型番の書き方が2通りあるのでどちらでも切れるようにする。
    model = ""
    title_m = re.search(r"<title>([^<|]+?)\s*買取価格相場", html)
    if title_m:
        model = re.split(r"\s*(?:Ref\.|[0-9]{3,}[0-9.]*\s*$)", title_m.group(1).strip())[0].strip()
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


def parse_quark3(html: str, url: str) -> list[dict]:
    """クォークの3列表（モデル / Ref.No. / 通常査定額(上限)）。

    ⚠️ ロレックスのページは5列（素材・文字盤あり）で、既存の parse_quark が対応している。
       オメガのページは3列なので別扱いにする。同じ会社でもブランドごとに表が違う。
       なお同ページ上部には価格が画像(GIF)の区画もあるが、そちらは読まない。
    """
    out = []
    pat = re.compile(
        r"<td><b>([^<]{2,40})</b></td>\s*<td><b>([A-Za-z0-9./-]{4,20})</b></td>"
        r"\s*<td[^>]*>￥([\d,]+)</td>"
    )
    for m in pat.finditer(html):
        v = yen(m.group(3))
        if v:
            out.append({"shop": "クォーク", "shop_id": "quark", "ref": norm_ref(m.group(2)),
                        "model": m.group(1).strip(),
                        "price_type": "上限", "condition": "中古", "price_jpy": v,
                        "source_url": url, "fetched_at": TODAY})
    return out


def parse_watchnian(html: str, url: str) -> list[dict]:
    """ウォッチニアン（buy.watchnian.com/brand_xxx/）。

    1ブロック = 1型番で、新品／中古の買取上限額が入る。
      <p class="casestudyList04_title">サブマリーナ</p>
      <p class="casestudyList04_sub">116610LN 【※保証書日付や状態で金額は変わります】</p>
      <dt><span>中 古 品</span></dt><dd><strong>～¥1,680,000</strong></dd>
    ⚠️ 掲載額は「〜」付きの上限値なので、price_type は「上限」で入れる
       （大黒屋と同じ扱い。中央値として扱わないこと）。
    ⚠️ 状態ラベルは全角スペース入り（"新　　品" / "中 古 品"）なので空白を潰して判定する。
    """
    out: list[dict] = []
    blocks = re.findall(
        r'casestudyList04_title">([^<]+)</p>\s*<p class="casestudyList04_sub">([^<\s]+)[^<]*</p>(.*?)'
        r'(?=casestudyList04_title"|\Z)', html, re.S)
    for model, ref, body in blocks:
        ref = norm_ref(ref.strip())
        if not ref:
            continue
        for cond_raw, price in re.findall(
                r'<dt><span>([^<]+)</span></dt>\s*<dd><strong>[^\d]*([\d,]+)</strong>', body):
            cond = re.sub(r"[\s\u3000]", "", cond_raw)
            v = yen(price)
            if not v:
                continue
            out.append({"shop": "ウォッチニアン", "shop_id": "watchnian", "ref": ref,
                        "model": model.strip(), "dial": "",
                        "price_type": "上限", "condition": "新品" if "新品" in cond else "中古",
                        "price_jpy": v, "source_url": url})
    return out


def main() -> None:
    records: list[dict] = []
    errors: list[str] = []

    # (名前, URL, 文字コード, パーサ, ブランド)
    jobs = [("jackroad", "https://www.jackroad.co.jp/shop/pages/j_rolex_kaitori.aspx", "cp932", parse_jackroad, "ロレックス"),
            ("quark", "https://www.909.co.jp/rolex_buy.html", "utf-8", parse_quark, "ロレックス")]
    for series in ["submariner", "daytona", "gmt_master", "explorer", "datejust", "daydate"]:
        jobs.append((f"daikokuya:{series}",
                     f"https://kaitori.e-daikoku.com/brand/brand/rolex_{series}.html",
                     "utf-8", parse_daikokuya, "ロレックス"))
    # ブランド拡張（2026-08-14）。型番別の買取価格を公表しているブランドのみ追加する。
    # 実測: 大黒屋はオメガ44型番/AP37/VC24に価格表あり。カルティエ・IWC等は型番表なし。
    # クォークはオメガのみ3列表で公表。ジャックロードのオメガページには型番別価格表がない。
    jobs.append(("daikokuya:omega",
                 "https://kaitori.e-daikoku.com/brand/brand/omega.html",
                 "utf-8", parse_daikokuya, "オメガ"))
    jobs.append(("daikokuya:audemarspiguet",
                 "https://kaitori.e-daikoku.com/brand/brand/audemarspiguet.html",
                 "utf-8", parse_daikokuya, "オーデマ・ピゲ"))
    jobs.append(("daikokuya:vacheronconstantin",
                 "https://kaitori.e-daikoku.com/brand/brand/vacheronconstantin.html",
                 "utf-8", parse_daikokuya, "ヴァシュロン・コンスタンタン"))
    jobs.append(("quark:omega", "https://www.909.co.jp/omega_buy.html", "utf-8", parse_quark3, "オメガ"))

    # 5社目（2026-08-28）。ウォッチニアンは型番別の買取上限額を毎日更新で公表している。
    # 実測の内訳: ロレックス51 / オメガ42 / カルティエ12 / IWC5 / パネライ3 / ウブロ1。
    # ⚠️ カルティエ・IWC・パネライは他社と型番が重ならず2社そろわない（公開対象にならない）。
    #    それでも取得はする——将来6社目が入ったときに即2社になるため。
    for _b, _label in [("rolex", "ロレックス"), ("omega", "オメガ"), ("cartier", "カルティエ"),
                       ("iwc", "IWC"), ("panerai", "パネライ"), ("hublot", "ウブロ")]:
        jobs.append((f"watchnian:{_b}", f"https://buy.watchnian.com/brand_{_b}/",
                     "utf-8", parse_watchnian, _label))

    for name, url, enc, parser, brand in jobs:
        try:
            html = fetch(url, enc)
            rows = parser(html, url)
            for _r in rows:
                _r["brand"] = brand   # ブランドはレコードに持たせる（マスタで固定しない）
            records.extend(rows)
            print(f"{name}: {len(rows)} records")
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"NG {name}: {e}")
        time.sleep(SLEEP)

    # なんぼや: 他社と突合できる型番を優先して取得
    other_refs = {r["ref"] for r in records}
    nb_urls = []
    for fn in ("nanboya-ref-urls.txt", "nanboya-omega-ref-urls.txt",
               "nanboya-other-ref-urls.txt"):
        p = ROOT / "data" / fn
        if p.exists():
            nb_urls += [u.strip() for u in p.read_text().splitlines() if u.strip()]

    nb_ref = nanboya_ref

    # ⚠️ 取得はNANBOYA_CAPで打ち切られるため、優先順位が変わると
    #    「昨日まで2社以上そろっていた型番」が今日1社に落ち、公開中のページが消える。
    #    実際に大黒屋のパーサを直した日に、デイトナ9型番がこれで落ちた。
    #    そのため「前日すでに2社以上そろっていた型番」を最優先で固定する。
    def already_published() -> set[str]:
        snaps = sorted((ROOT / "data" / "prices").glob("*.json"))
        prev = [f for f in snaps if f.stem != TODAY]
        if not prev:
            return set()
        recs = json.loads(prev[-1].read_text(encoding="utf-8")).get("records", [])
        month = prev[-1].stem[:7]
        by: dict[str, set[str]] = {}
        for r in recs:
            if r.get("price_month") and r["price_month"] != month:
                continue
            by.setdefault(r["ref"], set()).add(r["shop"])
        return {k for k, v in by.items() if len(v) >= 2}

    keep = already_published()
    tier1 = [u for u in nb_urls if nb_ref(u) in keep]                              # 既存ページを維持
    tier2 = [u for u in nb_urls if nb_ref(u) in other_refs and nb_ref(u) not in keep]  # 新たに2社目になれる
    tier3 = [u for u in nb_urls if nb_ref(u) not in other_refs and nb_ref(u) not in keep]
    for u in (tier1 + tier2 + tier3)[:NANBOYA_CAP]:
        try:
            html = fetch(u)
            rows = parse_nanboya(html, u)
            for _r in rows:
                _r["brand"] = nanboya_brand(u)
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
        e = master["refs"].setdefault(ref, {"brand": r.get("brand", "ロレックス"), "models": [], "shops": []})
        # 既存レコードのブランドが不明/誤りの場合は取得元の値で上書きする
        if r.get("brand") and e.get("brand") != r["brand"] and r["brand"] != "ロレックス":
            e["brand"] = r["brand"]
        if r.get("model") and r["model"] not in e["models"]:
            e["models"].append(r["model"])
        if r["shop_id"] not in e["shops"]:
            e["shops"].append(r["shop_id"])
    # ⚠️ マスタは setdefault で積むだけなので、型番の正規化ルールを変えると
    #    旧表記のキーが残り続ける（実測: ヴァシュロンの 4500V/110A-B126 が
    #    正規化後の 4500V.110A.B126 と二重に残っていた）。
    #    残骸は summarize がnullを返すので害はないが、マスタ件数が実態とずれて
    #    「何型番あるのか」を誤って読むことになる。当日のレコードに無いキーは落とす。
    live = {r["ref"] for r in records}
    dropped = [k for k in master["refs"] if k not in live]
    for k in dropped:
        del master["refs"][k]
    if dropped:
        print(f"マスタから旧表記/消滅した型番を除去: {len(dropped)}件")

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
