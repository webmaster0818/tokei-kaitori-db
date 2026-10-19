#!/usr/bin/env python3
"""引き継ぎ期限切れの日（10/15・10/24）に、ガード停止を確認し「消えたURLが予定どおりか」を照合する。

読むだけ。commit・push・デプロイ・通知はしない（標準ライブラリのみ・ネットワークは使わない）。
§3 は一時ディレクトリで next build を1回走らせる（約30秒〜1分）。

使い方（ガードで止まった日の 11:40 以降に）:
  python3 -I reports/expiry-check.py --date 2026-10-15 --expected reports/expiry-2026-10-15-urls.txt

判定（すべて満たしたときだけ exit 0 = 「通してよい」）:
  1. その日の実行がガードで止まっている（ログに急減行あり・コミット/push/デプロイ行なし・HEAD は前日のまま）
  2. 消えたURL == 予定リスト（--expected）。予定より少ない分はウォッチニアンが当日再掲載した型番に限り可
  3. 消えたURL == HEAD のスナップショットから「引き継ぎ期限切れの行だけ」を落として作った sitemap との差
     （＝期限切れ以外の理由で消えたURLが無い）
  4. 5店すべてが当日取得できている（期限切れ以外の引き継ぎ・取得失敗が無い）
  5. out/ の ref ページ数が sitemap の ref 数と一致し、消えたURLのページが out/ に無い
exit 1 = 不一致あり（通さない）／ exit 2 = ガードで止まった状態ではない（手順書 §1 の分岐へ）
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

SHOPS = ["なんぼや", "大黒屋", "クォーク", "ジャックロード", "ウォッチニアン"]
CARRY_DAYS = 14  # scripts/fetch-watch-prices.py と同じ値


def git(repo, *a, check=True):
    return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True, check=check).stdout


def locs(xml):
    return re.findall(r"<loc>(.*?)</loc>", xml)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(Path.home() / "projects/tokei-kaitori-db"))
    ap.add_argument("--date", required=True)
    ap.add_argument("--expected", required=True, help="消えるはずのURL（1行1URL）")
    ap.add_argument("--log", default="/tmp/tokei-daily.log")
    a = ap.parse_args()
    repo, D = Path(a.repo), a.date
    ok = True

    def res(cond, msg):
        nonlocal ok
        print(("  OK  " if cond else "  NG  ") + msg)
        ok = ok and cond

    # ---- 1. ガード停止の確認 ----
    print(f"[1] {D} の実行がガードで止まったか")
    lines = [l for l in Path(a.log).read_text(encoding="utf-8", errors="replace").splitlines()
             if l.startswith(f"[{D} ")]
    stop = [l for l in lines if "公開URLが急減" in l]
    after = [l for l in lines if any(k in l for k in ("コミット完了", "push OK", "デプロイOK", "=== 完了 ==="))]
    print("      ログ: " + (stop[-1] if stop else "（急減の行なし）"))
    head_subj = git(repo, "log", "-1", "--format=%s %ad", "--date=format:%F %T").strip()
    print(f"      HEAD: {head_subj}")
    dirty = git(repo, "status", "--porcelain").splitlines()
    snap_rel = f"data/prices/{D}.json"
    daily_today = git(repo, "log", "--format=%s", "--grep", f"スナップショット {D}").strip()
    guard_stopped = bool(stop) and not after and not daily_today
    if not guard_stopped:
        print("  →  ガードで止まった状態ではない（自動で通った／まだ実行中／未実行）。手順書 §1 の分岐を見る")
        return 2
    res(any(snap_rel in l for l in dirty), f"{snap_rel} が未コミットで存在")
    res(any(l.endswith("public/sitemap.xml") for l in dirty), "public/sitemap.xml が未コミットで変更あり")

    doc = json.loads((repo / snap_rel).read_text(encoding="utf-8"))
    # 予定より「少なく」消えた分は、ウォッチニアンが当日その型番を再掲載していれば問題ない（減る方向ではない）
    relisted = {str(r["ref"]).lower() for r in doc["records"]
                if r["shop"] == "ウォッチニアン" and (r.get("fetched_at") or "")[:10] == D}

    def explained(urls):
        return all("/ref/" in u and u.rstrip("/").rsplit("/", 1)[-1] in relisted for u in urls)

    # ---- 2. 実際に消えたURL ----
    prev = locs(git(repo, "show", "HEAD:public/sitemap.xml"))
    now = locs((repo / "public/sitemap.xml").read_text(encoding="utf-8"))
    lost, gained = sorted(set(prev) - set(now)), sorted(set(now) - set(prev))
    m = re.search(r"急減 (\d+) → (\d+)", stop[-1])
    print(f"[2] sitemap HEAD {len(prev)} → 作業ツリー {len(now)}（消えた {len(lost)}・増えた {len(gained)}）")
    if m:
        res((int(m[1]), int(m[2])) == (len(prev), len(now)), f"ログの数（{m[1]}→{m[2]}）と sitemap の実数が一致")
    for u in gained:
        print(f"      + {u}")

    expected = [l.strip() for l in Path(a.expected).read_text(encoding="utf-8").splitlines()
                if l.strip() and not l.startswith("#")]
    left = set(expected) - set(lost)
    res(set(lost) <= set(expected) and explained(left),
        f"消えたURL == 予定リスト（{len(expected)}本）" + (f"（うち {len(left)} 本は当日再掲載で残った）" if left else ""))
    for u in sorted(set(lost) - set(expected)):
        print(f"      予定外に消えた: {u}")
    for u in sorted(set(expected) - set(lost)):
        print(f"      予定だが残った: {u}" + ("（ウォッチニアン当日再掲載）" if explained([u]) else "（再掲載では説明できない）"))

    # ---- 3. 期限切れだけで説明できるか（HEAD のコピーで再現） ----
    with tempfile.TemporaryDirectory(prefix="bwb-expiry-") as td:
        subprocess.run(f"git -C '{repo}' archive HEAD | tar -x -C '{td}'", shell=True, check=True)
        snaps = sorted((Path(td) / "data/prices").glob("*.json"))
        base_doc = json.loads(snaps[-1].read_text(encoding="utf-8"))
        Dd = date.fromisoformat(D)
        keep = [r for r in base_doc["records"]
                if not r.get("fetched_at") or (Dd - date.fromisoformat(r["fetched_at"][:10])).days <= CARRY_DAYS]
        expired = len(base_doc["records"]) - len(keep)
        (Path(td) / f"data/prices/{D}.json").write_text(
            json.dumps({**base_doc, "records": keep}, ensure_ascii=False), encoding="utf-8")
        # ⚠️ 2026-10-17 のフェーズ1以降、generate-sitemap.mjs は out/（next build の出力）を列挙する方式になり、
        #    単体では動かない（out/data/refs.json が無いと exit 1）。HEAD のコピーで next build から通す。
        #    node_modules はシンボリックリンクだと Turbopack が拒否するので APFS クローン（cp -cR）で複製する。
        subprocess.run(["cp", "-cR", str(repo / "node_modules"), str(Path(td) / "node_modules")], check=True)
        b = subprocess.run(["npm", "run", "build"], cwd=td, capture_output=True, text=True,
                           env={**os.environ, "NODE_OPTIONS": "--max-old-space-size=8192"})
        if b.returncode != 0:
            print(b.stdout[-2000:], b.stderr[-2000:], sep="\n")
            res(False, "[3] HEAD のコピーでのビルド")
            return 1
        sim = locs((Path(td) / "public/sitemap.xml").read_text(encoding="utf-8"))
    lost_sim = sorted(set(prev) - set(sim))
    print(f"[3] HEAD のスナップショット {snaps[-1].stem} から期限切れ {expired} 行だけ落とすと {len(prev)} → {len(sim)}")
    left_sim = set(lost_sim) - set(lost)
    res(set(lost) <= set(lost_sim) and explained(left_sim),
        f"消えたURL == 期限切れだけで消えるURL（{len(lost_sim)}本）" + (f"（うち {len(left_sim)} 本は当日再掲載で残った）" if left_sim else ""))
    for u in sorted(set(lost) - set(lost_sim)):
        print(f"      期限切れでは説明できない減少: {u}")
    for u in sorted(set(lost_sim) - set(lost)):
        print(f"      期限切れで消えるはずが残った: {u}" + ("（ウォッチニアン当日再掲載）" if explained([u]) else "（再掲載では説明できない）"))

    # ---- 4. 当日の取得 ----
    print(f"[4] {D} のスナップショット（carried_over={doc.get('carried_over')}）")
    for s in SHOPS:
        rows = [r for r in doc["records"] if r["shop"] == s]
        today = sum(1 for r in rows if (r.get("fetched_at") or "")[:10] == D)
        olds = sorted({(r.get("fetched_at") or "?")[:10] for r in rows} - {D})
        res(today > 0, f"{s}: 当日取得 {today} 行" + (f"（引き継ぎ {len(rows) - today} 行 {olds}）" if olds else ""))
    stale = [r for r in doc["records"] if r.get("fetched_at")
             and (Dd - date.fromisoformat(r["fetched_at"][:10])).days > CARRY_DAYS]
    res(not stale, f"期限（{CARRY_DAYS}日）を超えた行が残っていない（{len(stale)} 行）")
    res(set(doc.get("carried_over") or {}) <= {"ウォッチニアン"}, "引き継ぎ中の店はウォッチニアンのみ")

    # ---- 5. out/ ----
    out = repo / "out/ref"
    built = {p.name for p in out.iterdir() if (p / "index.html").exists()} if out.exists() else set()
    sm_refs = {u.rstrip("/").rsplit("/", 1)[-1] for u in now if "/ref/" in u}
    print(f"[5] out/ref のページ {len(built)}・sitemap の ref {len(sm_refs)}")
    res(built == sm_refs, "out/ref と sitemap の ref が一致")
    res(not any(u.rstrip("/").rsplit("/", 1)[-1] in built for u in lost if "/ref/" in u), "消えたURLのページが out/ に無い")

    print("\n判定: " + ("一致 → 通してよい（手順書 §4）" if ok else "不一致あり → 通さない（手順書 §3-NG）"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
