#!/usr/bin/env python3
"""brandwatchbank のデザイン案を Nano Banana Pro で作る（2026-10-17 MediaXAI「高級時計・洗練された大人・モダン」。
cleaning-choices / golf-simulate（10/16）と同じ進め方＝FV3案＋ロゴ5案を先に見せる）。
  python3 scripts/gen-design-proposals.py [logo|fv|all]   → design-proposals/（リポには入れない）
⚠️ FV の数字は data で確かめた事実だけ: 公開型番206・比較5社（ジャックロード/クォーク/大黒屋/なんぼや/ウォッチニアン）・4ブランド・毎日更新。
⚠️ 時計は実在ブランドのロゴ・王冠・文字盤の銘を描かせない（商標）。
"""
import base64, json, os, sys, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; OUT = ROOT / "design-proposals"; MODEL = "gemini-3-pro-image-preview"
def key():
    if os.environ.get("GEMINI_API_KEY"): return os.environ["GEMINI_API_KEY"]
    for l in (Path.home() / ".openclaw/workspace/secrets/shiroari-expert-keys.env").read_text().splitlines():
        if l.startswith("GEMINI_API_KEY="): return l.split("=", 1)[1].strip().strip('"')
LOGO = ("Minimal luxury brand mark for a Japanese pre-owned luxury watch buyback price database website. Monochrome fine line art "
        "in near-black #111111 on pure white, single thin consistent stroke weight, geometric, refined, timeless, generous negative space, "
        "centered, crisp vector-like edges, no gradients, no shadows, no text, no letters, no existing brand logos or crowns. Concept: ")
LOGOS = {
  "logo-a-dial-chart": "a round watch dial outline with two hands, where the hour markers rise like a small bar chart, merging time and price data",
  "logo-b-bezel-ledger": "a watch bezel ring with minute ticks, inside it three thin horizontal lines like a ledger, suggesting a price record book",
  "logo-c-case-lugs": "a minimalist front view of a watch case with lugs and crown, the dial replaced by an upward trend line",
  "logo-d-crown-key": "a watch winding crown drawn as an elegant knurled cylinder, its stem shaped like a key, suggesting value and a bank vault",
  "logo-e-gear-coin": "a fine mechanical watch gear whose center is a coin with a single vertical line, balance between craft and value",
}
FV_BASE = ("Website first-view hero design mockup, 16:9 desktop, for a Japanese luxury watch buyback price database site. "
  "Sophisticated, mature, modern, quiet luxury, world-class refined editorial design, generous whitespace, thin hairline 1px borders, "
  "no emoji, no clip art, no cheap sale banners. Elegant serif display type (Mincho / Didone style) for headlines, clean sans for UI. "
  "Photorealistic macro product photography of an unbranded luxury steel sports chronograph wristwatch, sapphire crystal, sharp details, "
  "dramatic soft studio lighting, absolutely no brand names, no logos, no crown emblem, no text on the dial. "
  "All Japanese text rendered cleanly, legibly, exactly as given, no other text: small header logo text 「時計買取相場データベース」 and nav "
  "「ブランド」「モデル」「型番から探す」「掲載ポリシー」, headline 「その時計の、いまの価値を。」, sub copy 「型番ごとの買取価格を、主要買取店5社で毎日比較。」, "
  "a slim search box with placeholder 「型番を入力（例：126610LN）」, two equal buttons 「ブランドから探す」「モデルから探す」, "
  "and a stat row with four items 「掲載 206型番」「比較 5社」「4ブランド」「毎日更新」. ")
FVS = {
  "fv-1-noir": FV_BASE + "Palette: deep ink black #0d0d0f background, warm champagne gold #b89b6a accents used sparingly on hairlines and buttons outline, off-white text. Layout: watch photo large on the right emerging from darkness, text left-aligned, stat row separated by thin gold vertical dividers.",
  "fv-2-ivory": FV_BASE + "Palette: warm ivory #f6f3ee background, charcoal #1c1c1c text, muted brass #8c7448 accent. Layout: left 45% text and search, right 55% the watch on a stone and leather surface in soft daylight, framed by a thin hairline border; stats as four bordered cards beneath.",
  "fv-3-navy": FV_BASE + "Palette: midnight navy #0f1a2b, white text, silver-gray #c9ccd1 hairlines. Layout: full-bleed close-up of the watch dial and bezel across the hero, centered headline and search box over a soft dark gradient, a thin translucent stat strip along the bottom.",
}
def gen(name, prompt, aspect):
    out = OUT / f"{name}.png"
    if out.exists(): print("skip", name); return
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect, "imageSize": "2K"}}}).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key()}"
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=240) as r:
        d = json.loads(r.read())
    for p in d["candidates"][0]["content"]["parts"]:
        if "inlineData" in p: out.write_bytes(base64.b64decode(p["inlineData"]["data"])); print("ok", name); return
    print("no image", name)
if __name__ == "__main__":
    from concurrent.futures import ThreadPoolExecutor
    w = sys.argv[1] if len(sys.argv) > 1 else "all"; OUT.mkdir(exist_ok=True)
    jobs = []
    if w in ("logo", "all"): jobs += [(n, LOGO + c, "1:1") for n, c in LOGOS.items()]
    if w in ("fv", "all"): jobs += [(n, p, "16:9") for n, p in FVS.items()]
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: gen(*j), jobs))
