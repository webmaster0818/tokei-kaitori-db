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
from datetime import date, datetime
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
# 「前日公開していた型番」を何日さかのぼって拾うか（取得元の一時障害に耐えるため）
KEEP_LOOKBACK_DAYS = 5


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
    """ウォッチニアン。2026-10-06 に新サイト（watchnian.com/buy/）の構造へ書き換え。

    旧サイト（buy.watchnian.com/brand_xxx/・casestudyList04_*）は 10/1 に停止し、10/6 に
    `watchnian.com/buy/categories/item_watch/brand_xxx/` へ 301 で移った。価格表の1カードが1型番:
      <article class="c-price-card">
        <h4 class="c-price-card__name">ロレックス サブマリーナ 126613LN</h4>
        <p class="c-price-card__color">ブラック</p>
        <span class="c-badge c-badge--dark">新品</span>
        <span class="c-price-card__amount"><span class="c-price-card__yen">¥</span>3,110,000</span>
        <span class="c-badge c-badge--gray">中古</span>
        <span class="c-price-card__amount-sub">～￥2,820,000</span>
        <p class="c-price-card__date">更新日<span class="c-price-card__date-value">2026.09.30 00:01</span></p>
    ⚠️ 金額の span の中に「¥」の span が入れ子になっている。`</span>` までで切ると金額が取れない
       （最初の実装で 3 件しか取れなかった原因）。行の `</div>` までを取って、タグを剥がして読む。
    ⚠️ 「お問合せください」の行は価格なし → スキップ（捏造しない）。
    ⚠️ 同じページに「買取実績」のカード（c-record-card・過去に買い取った額）もある。
       これは提示額ではないので読まない（c-price-card だけを対象にする）。
    ⚠️ 「～」付きは上限額（price_type=上限）。新サイトの新品は「～」無しの定額表示なので「通常」で入れる
       （上限の比較に混ぜない。表示上は価格種別の列で区別がつく）。
    ⚠️ 同じ型番が文字盤色ごとに複数カードある（126710BLRO ×2 等）。(型番, 状態) ごとに最大額を採る。
    ⚠️ 詳細ページ（/buy/listing/…）にも同じカードがあるが、一覧と同じ内容だったので巡回しない。
    """
    rows: dict[tuple[str, str], dict] = {}
    for card in re.findall(r'<article class="c-price-card">(.*?)</article>', html, re.S):
        m = re.search(r'c-price-card__name">([^<]+)', card)
        if not m:
            continue
        name = m.group(1).strip()
        parts = name.split()
        if len(parts) < 2:
            continue
        # 末尾のトークンが型番。「126710BLNRジュビリー」のように和文が続くことがあるので ASCII だけ残す
        ref = norm_ref(re.sub(r"[^\x21-\x7e]", "", parts[-1]))
        if not ref or not re.search(r"\d", ref):
            continue
        model = " ".join(parts[1:-1])  # 先頭はブランド名（ロレックス 等）
        dial_m = re.search(r'c-price-card__color">([^<]*)', card)
        upd_m = re.search(r'date-value">([^<]+)', card)
        for cond, body in re.findall(r'c-badge--\w+">(新品|中古)</span>(.*?)</div>', card, re.S):
            txt = re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", body))
            pm = re.search(r"([\d,]{5,})", txt)
            if not pm:
                continue  # 「お問合せください」等
            v = yen(pm.group(1))
            if not v:
                continue
            is_ceiling = ("～" in txt) or ("〜" in txt)
            rec = {"shop": "ウォッチニアン", "shop_id": "watchnian", "ref": ref,
                   "model": model, "dial": (dial_m.group(1).strip() if dial_m else ""),
                   "price_type": "上限" if is_ceiling else "通常", "condition": cond,
                   "price_jpy": v, "source_url": url, "fetched_at": TODAY,
                   "page_updated": upd_m.group(1).strip() if upd_m else None}
            k = (ref, cond)
            if k not in rows or v > rows[k]["price_jpy"]:
                rows[k] = rec
    return list(rows.values())


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
    # ⚠️ 2026-08-31、クォークが omega_buy.html から**型番別の買取価格表を撤去**した
    #    （ページは200で開くが、円表記0件・型番0件。当方のパーサのバグではない）。
    #    先方が復活させたら自動で戻るようジョブは残す。0件でも失敗にはしない。
    #    影響: オメガの公開型番が 41→37 に減少（クォークが2社目だった型番が落ちた）。
    jobs.append(("quark:omega", "https://www.909.co.jp/omega_buy.html", "utf-8", parse_quark3, "オメガ"))

    # 5社目（2026-08-28）。ウォッチニアンは型番別の買取上限額を毎日更新で公表している。
    # 実測の内訳: ロレックス51 / オメガ42 / カルティエ12 / IWC5 / パネライ3 / ウブロ1。
    # ⚠️ カルティエ・IWC・パネライは他社と型番が重ならず2社そろわない（公開対象にならない）。
    #    それでも取得はする——将来6社目が入ったときに即2社になるため。
    # ⚠️ 2026-10-01〜10-05 停止。10/6 に新サイト watchnian.com/buy/ で復旧（旧URLは 301）。
    #    新URLを直接叩く。実測（10/6）: ロレックス68カード中54に価格・オメガ32。
    for _b, _label in [("rolex", "ロレックス"), ("omega", "オメガ"), ("cartier", "カルティエ"),
                       ("iwc", "IWC"), ("panerai", "パネライ"), ("hublot", "ウブロ")]:
        jobs.append((f"watchnian:{_b}",
                     f"https://watchnian.com/buy/categories/item_watch/brand_{_b}/",
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
        # ⚠️ 前日1日分だけを見てはいけない（2026-10-02に判明）。
        #    取得元が1日落ちると、その日のスナップショットは既に欠けた状態なので、
        #    「昨日公開していた型番」が少なく見積もられ、優先順位から外れて今日も取得されない。
        #    ＝障害が1日で終わっても、こちらの都合でページが戻らない。
        #    直近数日のどれかで2社そろっていれば維持する（union）。
        recs = []
        for f in prev[-KEEP_LOOKBACK_DAYS:]:
            recs.extend(json.loads(f.read_text(encoding="utf-8")).get("records", []))
        # ⚠️ ここで「ファイル名の暦月」で絞ってはいけない（2026-10-02に判明）。
        #    月が変わった瞬間、月次公開のなんぼやは当月データが少ないため keep が縮み、
        #    NANBOYA_CAP の優先順位から外れた型番が今日は取得されず、公開中のページが消える。
        #    実際に10/1〜10/2で15ページがこれで落ちた。
        #    lib/prices.ts の currentRecords() と同じ「店ごとに最も新しい月」で数える。
        newest: dict[tuple[str, str], str] = {}
        for r in recs:
            if not r.get("price_month"):
                continue
            k = (r["ref"], r["shop"])
            if k not in newest or r["price_month"] > newest[k]:
                newest[k] = r["price_month"]
        by: dict[str, set[str]] = {}
        for r in recs:
            if r.get("price_month") and newest.get((r["ref"], r["shop"])) != r["price_month"]:
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

    # ⚠️ 店のサイトが落ちると、その店のレコードが丸ごと0件になり、
    #    2社目を失った型番のページが**その日のうちに404になる**。
    #    2026-10-01にウォッチニアンが落ち（www=502・buyは接続不可）、192件→0件。
    #    32ページが消え、うち20ページは直近28日に検索表示があった（最大76表示・クリックあり）。
    #    先方が復旧すれば戻るものを、こちらが消してしまうのは損。
    #    → 今日0件だった店は、直近で取れていた日の値を引き継ぐ。
    #      各レコードは元の fetched_at を持っており、ページには取得日が出るので
    #      「いつ時点の価格か」は読者に正しく伝わる。古すぎるものは引き継がない。
    CARRY_DAYS = 14
    today_shops = {r["shop"] for r in records}
    snaps = sorted((ROOT / "data" / "prices").glob("*.json"))
    carried: dict[str, str] = {}
    for f in reversed([x for x in snaps if x.stem != TODAY]):
        if (date.fromisoformat(TODAY) - date.fromisoformat(f.stem)).days > CARRY_DAYS:
            break
        prev = json.loads(f.read_text(encoding="utf-8")).get("records", [])
        for shop in {r["shop"] for r in prev} - today_shops - set(carried):
            rows = [r for r in prev if r["shop"] == shop]
            # ⚠️ 取得日が入っていないレコードがある（ウォッチニアンは入れていなかった）。
            #    引き継ぐ以上、いつ取った値かを必ず持たせる。無いとページで空欄になる。
            for r in rows:
                r.setdefault("fetched_at", None)
                if not r["fetched_at"]:
                    r["fetched_at"] = f.stem
            # ⚠️ 前日のスナップショットには「引き継いだ行」も入っている。ファイルの日付だけで
            #    判定すると、前日→今日→翌日と受け渡されて期限が永久に来ない（2026-10-05 に発見。
            #    9/30 の値が 10/4 まで毎日「前日から」引き継がれていた）。行の元の取得日で切る。
            rows = [r for r in rows
                    if (date.fromisoformat(TODAY) - date.fromisoformat(r["fetched_at"][:10])).days <= CARRY_DAYS]
            if not rows:
                continue
            records.extend(rows)
            carried[shop] = f.stem
            errors.append(f"{shop}: 今日は0件。{f.stem} の {len(rows)}件を引き継いだ")
            print(f"⚠️ {shop} が0件 → {f.stem} の {len(rows)}件を引き継ぎ")
    # ⚠️ 復旧直後の店（前回のスナップショットで引き継ぎ中だった店）は、新サイトで掲載型番が
    #    入れ替わっていることがある（2026-10-06 ウォッチニアン: 112型番→101。43型番が消え、32型番が増えた）。
    #    店が「今日は取れた」扱いになると上の引き継ぎが止まり、消えた型番の2社目が一斉に落ちて
    #    公開URLが 215→199（-7%）になる＝5%の公開停止ガードに掛かり、増えた8ページも出せない。
    #    → 復旧した店について、前回まで引き継いでいた型番だけは同じ期限（元の取得日から14日）まで引き継ぐ。
    #      期限が来れば自然に消える。恒久的に残す仕組みではない。ページには元の取得日が出る。
    prev_snaps = [x for x in snaps if x.stem != TODAY]
    if prev_snaps:
        prev_doc = json.loads(prev_snaps[-1].read_text(encoding="utf-8"))
        for shop in set(prev_doc.get("carried_over", {})) & today_shops:
            today_refs = {r["ref"] for r in records if r["shop"] == shop}
            rows = [r for r in prev_doc.get("records", [])
                    if r["shop"] == shop and r["ref"] not in today_refs and r.get("fetched_at")
                    and (date.fromisoformat(TODAY) - date.fromisoformat(r["fetched_at"][:10])).days <= CARRY_DAYS]
            if rows:
                records.extend(rows)
                carried[shop] = prev_snaps[-1].stem
                msg = (f"{shop}: 復旧したが掲載から消えた {len({r['ref'] for r in rows})}型番"
                       f"（{len(rows)}件）を前回の値（取得日つき）で引き継いだ")
                errors.append(msg)
                print("⚠️ " + msg)
    if carried:
        print(f"⚠️ 引き継いだ店: {carried}（先方サイトの復旧を確認すること）")

    # 保存
    out_dir = ROOT / "data" / "prices"
    out_dir.mkdir(parents=True, exist_ok=True)
    json.dump({"fetched_at": TODAY, "records": records, "errors": errors,
               "carried_over": carried},
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
