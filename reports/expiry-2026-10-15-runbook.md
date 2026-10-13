# 10/15 当日の手順書（ウォッチニアン 9/30 取得分の引き継ぎ期限切れ → ガード停止 → 確認して1回だけ通す）

- 作成: 2026-10-13（本番は触っていない。手順は複製リポ `/tmp/bwb1013/dry` で実際に通して検証済み → §7）
- 方針（10/13 朝に MediaXAI へ宣言した既定案）: 先方が載せていない価格は期限どおり外す。10/15 は 11:25 の実行がガードで止まったのを確認し、消えたURLが予定の15本と一致する（それ以外の減少が無い）ことを確かめてから、手作業で1回だけ通す。恒久ルールは入れない。
- 使うファイル
  - `reports/expiry-check.py` … 照合スクリプト（読むだけ。commit・push・デプロイ・通知はしない）
  - `reports/expiry-2026-10-15-urls.txt` … 消えるはずの15本
  - `reports/expiry-2026-10-24-urls.txt` … 10/24 用の19本（10/15 を 227 で通した前提）

## 0. 予定（10/13 に最新データで再計算）

`data/prices/2026-10-12.json`（HEAD 46741326・本番 sitemap 242）から、元の取得日から14日を超える行だけを落として `generate-sitemap.mjs` を実行:

| 日 | 公開URL | 減少 | しきい値（前日×95% 切捨て） | 判定 |
|---|---|---|---|---|
| 10/14 まで | 242 | — | — | — |
| **10/15** | **227** | −15（ウォッチニアン 9/30 取得 40行が失効） | 229 | **止まる** |
| 10/24 | 208 | −19（10/9 取得 40行が失効） | 215 | 止まる |

10/15 の15本は 10/12 の試算と**同じ**（116622 / 126713grnr / 210.92.42.20.01.001 / 222.32.38.50.01.001 / 222.32.38.50.01.003 / 228235 / 228239 / 231.10.39.21.02.002 / 231.10.44.50.01.001 / 231.10.44.50.06.001 / 232.30.42.21.01.001 / 232.30.46.21.01.001 / 310.30.42.50.01.001 / 311.30.42.30.01.004 / 3513.50）。

⚠️ 10/13・10/14 の取得で数字が動く可能性はある（ウォッチニアンの再掲載で減る本数が減る／増えるページがある）。照合スクリプトは「予定リスト」と「当日の HEAD から期限切れだけを落とした再現」の**両方**と比べるので、前日までに変化があってもその日の HEAD 基準で判定できる。**10/14 の 11:40 以降に §0 の再計算をもう一度だけやり、リストが変わっていたら `expiry-2026-10-15-urls.txt` を更新する**（コマンドは §6）。

## 1. ガード停止の確認（10/15 11:40 以降）

日次は launchd `com.tokei.daily-update` 11:25 開始、通常 11:38 前後に終わる（ガードで止まる日はビルド直後＝11:38 前後で止まる）。

```bash
cd ~/projects/tokei-kaitori-db
grep '^\[2026-10-15 ' /tmp/tokei-daily.log          # 期待: 開始 → 価格取得OK → ビルド+sitemap OK → 🚨 公開URLが急減 242 → 227
git log -1 --format='%h %s'                          # 期待: daily: 買取価格スナップショット 2026-10-14（HEAD は前日のまま）
git status --short | head                            # 期待: ?? data/prices/2026-10-15.json ・ M public/sitemap.xml ・ data/history/*
```
Discord（1481155786087469068）にも notify-drop の「公開URLが急減したので公開を止めました 242 → 227」が出る。

分岐:
- **止まっている** → §2 へ。
- **`=== 完了 ===` まで行っている（自動で通った）** → 減少が 5% 未満だった（再掲載等で減りが少ない）。§2 の照合は不要だが、§5 の本番確認で「消えたURLが予定の部分集合か」だけ見る（`git diff HEAD~1 HEAD -- public/sitemap.xml | grep '^-.*<loc>'`）。
- **ログに 10/15 の行が無い／途中で止まっている** → まだ実行中か、取得・ビルド失敗。`🚨 価格取得に失敗` `🚨 ビルド失敗` ならこの手順は中止して原因調査（期限切れとは別件）。

## 2. 照合（一致確認）

```bash
cd ~/projects/tokei-kaitori-db
python3 -I reports/expiry-check.py --date 2026-10-15 --expected reports/expiry-2026-10-15-urls.txt
echo "exit=$?"     # 0 = 通してよい ／ 1 = 不一致（通さない） ／ 2 = ガードで止まった状態ではない（§1 の分岐）
```

スクリプトが見ているもの（全部 OK のときだけ exit 0）:
1. ログに `[2026-10-15 …] 🚨 公開URLが急減` があり、コミット/push/デプロイ/完了の行が無い。`スナップショット 2026-10-15` のコミットが無い。スナップショットと sitemap が未コミットで存在
2. `HEAD:public/sitemap.xml` と作業ツリーの `public/sitemap.xml` の差 ＝ 予定リスト。ログの「242 → 227」と実数が一致
3. HEAD のコピー（`git archive`）で、HEAD のスナップショットから**期限切れ行だけ**を落として sitemap を作った差 ＝ 実際の差（期限切れ以外の理由で消えたURLが無い）
4. 5店すべてに当日取得の行がある・期限（14日）超えの行が残っていない・引き継ぎ中の店はウォッチニアンのみ
5. `out/ref` のページ ＝ sitemap の ref、消えたURLのページが `out/` に無い

- 予定より**少なく**消えた分は、ウォッチニアンがその日その型番を再掲載していれば OK 扱い（減る方向ではないため）。
- 予定**外**に消えたURLが1本でもあれば NG。

### NG のとき（通さない）
- 何も commit しない。止まったままにする（本番は 10/14 の版が出続ける＝404 は出ない）。
- 出力の「予定外に消えた」「当日取得 0 行」を見て、取得元の障害か（`curl -sI -A 'Mozilla/5.0' <取得元>`）、ウォッチニアンの再入れ替えかを切り分け、MediaXAI に報告して判断を仰ぐ。
- 翌日 11:25 も HEAD（242）と比べて止まる。原因が直って予定の15本だけの差に戻れば、その日に §2 からやり直せる（`--date` をその日にする）。

## 3. 通す前の最終目視

```bash
git status --short | grep -v '^ M data/history/' | head -20     # 期待: data/prices/2026-10-15.json・public/sitemap.xml・data/watch-master.json 程度。想定外のファイルが無いこと
python3 -c "import json;d=json.load(open('data/prices/2026-10-15.json'));print(d.get('carried_over'));print(*d.get('errors',[]),sep='\n')"
```

## 4. 通す（1回だけ・手作業）

`daily-update.sh` のガード以降と同じ処理を手で行う。**11:25 の実行が終わっていること（§1 で `急減` 行を確認済み）が前提**。

```bash
cd ~/projects/tokei-kaitori-db
git add -A
git commit -q -m "daily: 買取価格スナップショット 2026-10-15（承認済みの減少 242→227：ウォッチニアン 9/30 取得分の引き継ぎ期限切れ15本）

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin main && echo "push OK"

# Cloudflare Pages への直接アップロード（daily-update.sh と同じ。トークンはファイルから読み、表示しない）
CLOUDFLARE_ACCOUNT_ID="$(cat ~/.openclaw/workspace/secrets/cf-account-id.txt)" \
CLOUDFLARE_API_TOKEN="$(cat ~/.openclaw/workspace/secrets/cf-pages-token.txt)" \
  npx --yes wrangler@latest pages deploy out --project-name=tokei-kaitori-db --branch=main --commit-dirty=true
```

- 件名を `daily: 買取価格スナップショット 2026-10-15…` にするのは、日次の履歴として扱うため（照合スクリプトもこの件名でその日のコミット有無を判定している）。
- これで HEAD の sitemap が 227 になり、**10/16 11:25 からガードは 227 基準に戻る**（§7 で確認済み）。
- 本番は push（GitHub 連携のビルド）と wrangler（直接アップロード）の両方で更新される。日次スクリプトと同じく両方行う。

## 5. 本番確認（push から 5〜10 分後）

```bash
cd ~/projects/tokei-kaitori-db
UA='Mozilla/5.0'   # UA 無しだと Cloudflare が 403
[ "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/main | cut -f1)" ] && echo "remote 一致"
for h in brandwatchbank.com tokei-kaitori-db.pages.dev; do
  printf '%s sitemap=%s lastmod=%s\n' $h "$(curl -s -A "$UA" https://$h/sitemap.xml | grep -c '<loc>')" \
    "$(curl -s -A "$UA" https://$h/sitemap.xml | grep -o '<lastmod>[^<]*' | sort -u | tr '\n' ' ')"
done                                                   # 期待: どちらも 227・lastmod 2026-10-15
grep -v '^#' reports/expiry-2026-10-15-urls.txt | while read u; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" "$u")" "$u"; done | cut -c1-3 | sort | uniq -c   # 期待: 15 404（10/13 実行時は 15 200）
curl -s -A "$UA" https://brandwatchbank.com/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' | awk 'NR%12==1' |
  while read u; do curl -s -o /dev/null -w '%{http_code}\n' -A "$UA" "$u"; done | sort | uniq -c        # 期待: 抜き取り約20本すべて 200
```
- 古い版が出ていたら（sitemap 242 のまま）: GitHub 連携のビルド待ちの可能性。10 分待って再確認。それでも 242 なら wrangler の出力の Deployment URL を開いて 227 かを確認し、どちらの経路が反映されていないかを報告。
- 終わったら CLAUDE.md の作業ログに 1 段落、Discord に報告（結論→根拠→失敗→残アクション）。

## 6. 前日（10/14 11:40 以降）の再計算コマンド

```bash
mkdir -p /tmp/bwb1014/sim && git -C ~/projects/tokei-kaitori-db archive HEAD | tar -x -C /tmp/bwb1014/sim
python3 -I - <<'EOF'
import json, re, subprocess, glob
from datetime import date
root = "/tmp/bwb1014/sim"; D = date(2026, 10, 15)
f = sorted(glob.glob(f"{root}/data/prices/*.json"))[-1]; doc = json.load(open(f))
prev = re.findall(r"<loc>(.*?)</loc>", open(f"{root}/public/sitemap.xml").read())
keep = [r for r in doc["records"] if (D - date.fromisoformat(r["fetched_at"][:10])).days <= 14]
json.dump({**doc, "records": keep}, open(f"{root}/data/prices/{D}.json", "w"), ensure_ascii=False)
subprocess.run(["node", "scripts/generate-sitemap.mjs"], cwd=root, capture_output=True, check=True)
now = re.findall(r"<loc>(.*?)</loc>", open(f"{root}/public/sitemap.xml").read())
lost = sorted(set(prev) - set(now)); print(f, len(prev), "->", len(now), "threshold", len(prev) * 95 // 100)
print(*lost, sep="\n")
EOF
```
出力が `expiry-2026-10-15-urls.txt` と同じならそのまま。違えば差分の理由（再掲載・新規掲載）を確かめてからファイルを更新してコミット。

## 7. 検証（2026-10-13 に実施・本番未変更）

複製リポ `/tmp/bwb1013/dry`（`git clone` → origin をダミーの bare リポに付け替え → node_modules を `cp -cR`）に、10/12 スナップショットから「9/30 行を落とし、他の行の取得日を 10/15 にした」`2026-10-15.json` を置き、`daily-update.sh` の複製（取得・通知をスタブ、CF 資格情報なし、`date` を 10/15 に置換）を実行:

| ケース | daily-update.sh | expiry-check.py |
|---|---|---|
| 予定どおり（9/30 行だけ失効） | 🚨 242 → 227 で停止（exit 1） | **全項目 OK → exit 0** |
| ジャックロードも同日に 0 件（引き継ぎ無し） | 🚨 242 → 213 で停止 | **NG（予定外 14 本・ジャックロード当日 0 行）→ exit 1** |
| ウォッチニアンが 228239 を再掲載 | 🚨 242 → 228 で停止 | OK（1 本は当日再掲載で残った）→ exit 0 |
| ログに急減行なし | — | exit 2（ガード停止状態ではない） |

予定どおりのケースで §4 の commit + push（ダミーへ）を行い、続けて `daily-update.sh` を再実行 → **ガードは 227 基準で通過**（`データ変更なし → push OK → 完了`）。止まり続ける状態が 1 回の commit で解消することを確認。
