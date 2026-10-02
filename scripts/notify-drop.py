#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""公開URLが急減したときにDiscordへ知らせる（daily-update.sh から呼ばれる）。

⚠️ トークンはファイルから読む。引数にもログにも出さない。
"""
import json
import sys
import urllib.request
from pathlib import Path

CHANNEL = "1481155786087469068"   # MediaXAIのメインチャンネル


def main() -> int:
    prev, now = (sys.argv + ["?", "?"])[1:3]
    msg = (f"🚨 **brandwatchbank: 公開URLが急減したので公開を止めました** {prev} → {now}\n"
           "取得元の障害か、月替わりで2社そろわなくなった可能性があります。"
           "`/tmp/tokei-daily.log` と当日のスナップショットの `carried_over` を確認してください。")
    try:
        tok = json.loads(Path.home().joinpath(".openclaw/openclaw.json")
                         .read_text(encoding="utf-8"))["channels"]["discord"]["token"]
    except Exception as e:
        print("Discordトークンが読めない:", str(e)[:80])
        return 1
    req = urllib.request.Request(
        f"https://discord.com/api/v10/channels/{CHANNEL}/messages",
        data=json.dumps({"content": msg}).encode(),
        headers={"Authorization": f"Bot {tok}", "Content-Type": "application/json",
                 "User-Agent": "DiscordBot (https://mediax.biz, 1.0)"})
    try:
        urllib.request.urlopen(req, timeout=20)
        print("通知した")
    except Exception as e:
        print("通知失敗:", str(e)[:100])
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
