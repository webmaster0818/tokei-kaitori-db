import type { Series } from "@/lib/history";
import { fromMs } from "@/lib/history";
import { SHOP_COLORS, SHOP_IDS } from "@/lib/shops";

// 価格推移グラフ（サーバー側で描く静的 SVG。グラフ用ライブラリは使わない）。
// ⚠️ 値は lib/history.ts の priceSeries() の実レコードのみ。点と点の間が4日以上空いた所は線をつながない
//    （取得できなかった期間を、価格が続いていたかのように描かないため）。
// ⚠️ PC 用と スマホ用で別の SVG を描き、CSS で片方だけ表示する（縮小すると軸の文字が読めなくなるため）。

const DAY = 86400000;
const GAP = 4 * DAY;

export function seriesLabel(s: Series) {
  return `${s.shop}（${s.priceType}）`;
}

function niceStep(range: number, target: number) {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return Math.max(step, 10000);
}

function manLabel(v: number) {
  const x = v / 10000;
  return `${Number.isInteger(x) ? x.toLocaleString("ja-JP") : x.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円`;
}

function order(s: Series) {
  const i = SHOP_IDS.indexOf(s.shopId as (typeof SHOP_IDS)[number]);
  return (i < 0 ? 99 : i) * 10 + (s.priceType === "上限" ? 0 : s.priceType === "相場" ? 1 : 2);
}

function Plot({ series, start, end, w, h, font, idBase, title, desc, className }: {
  series: Series[]; start: number; end: number; w: number; h: number; font: number; idBase: string; title: string; desc: string; className: string;
}) {
  const pad = { l: font * 5.6, r: font * 1.2, t: font * 1.2, b: font * 2.6 };
  const vals = series.flatMap((s) => s.points.map((p) => p.v));
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) { lo -= 50000; hi += 50000; }
  const step = niceStep(hi - lo, h < 280 ? 4 : 5);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const span = Math.max(end - start, DAY);
  const x = (t: number) => pad.l + ((t - start) / span) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1; v += step) ticks.push(v);
  // 月の初日に目盛り
  const months: number[] = [];
  const d0 = new Date(start);
  for (let m = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1); m <= end; ) {
    months.push(m);
    const d = new Date(m);
    m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={`${idBase}-t ${idBase}-d`} preserveAspectRatio="xMidYMid meet">
      <title id={`${idBase}-t`}>{title}</title>
      <desc id={`${idBase}-d`}>{desc}</desc>
      <g fontSize={font} fill="var(--ink-3)" fontFamily="var(--sans)">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--rule-soft)" strokeWidth={1} />
            <text x={pad.l - font * 0.5} y={y(v)} dy="0.35em" textAnchor="end">{manLabel(v)}</text>
          </g>
        ))}
        {months.map((m) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={pad.t} y2={h - pad.b} stroke="var(--rule-soft)" strokeWidth={1} strokeDasharray="2 3" />
            <text x={x(m)} y={h - pad.b + font * 1.5} textAnchor="middle">{new Date(m).getUTCMonth() + 1}月</text>
          </g>
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="var(--rule)" strokeWidth={1} />
      </g>
      {series.map((s) => {
        const color = SHOP_COLORS[s.shopId] ?? "var(--ink-2)";
        const dash = s.monthly ? "1 4" : s.priceType === "通常" ? "6 4" : undefined;
        // 日次の値: 間が空いた所で線を切る
        const segs: { t: number; v: number }[][] = [];
        for (const p of s.points) {
          const cur = segs[segs.length - 1];
          if (cur && p.t - cur[cur.length - 1].t <= GAP) cur.push(p);
          else segs.push([p]);
        }
        const last = s.points[s.points.length - 1];
        return (
          <g key={s.key}>
            {segs.map((seg, i) =>
              seg.length > 1 ? (
                <polyline key={i} points={seg.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                  fill="none" stroke={color} strokeWidth={s.monthly ? 2.5 : 2} strokeDasharray={dash} strokeLinejoin="round" strokeLinecap={s.monthly ? "round" : undefined} />
              ) : (
                <circle key={i} cx={x(seg[0].t)} cy={y(seg[0].v)} r={2.5} fill={color} />
              ),
            )}
            <circle cx={x(last.t)} cy={y(last.v)} r={4} fill={color} stroke="#fff" strokeWidth={2}>
              <title>{`${seriesLabel(s)} ${last.label}: ${last.v.toLocaleString("ja-JP")}円`}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

export function PriceHistoryChart({ series, start, end, refLabel }: { series: Series[]; start: number; end: number; refLabel: string }) {
  const sorted = [...series].sort((a, b) => order(a) - order(b));
  const title = `${refLabel} の買取価格の推移（${fromMs(start)}〜${fromMs(end)}）`;
  const desc = sorted
    .map((s) => {
      const first = s.points[0], last = s.points[s.points.length - 1];
      return `${seriesLabel(s)}: ${first.label} ${first.v.toLocaleString("ja-JP")}円 → ${last.label} ${last.v.toLocaleString("ja-JP")}円`;
    })
    .join("。");
  return (
    <figure className="chart">
      <div className="chart__plot">
        <Plot series={sorted} start={start} end={end} w={760} h={320} font={12} idBase="phc-l" title={title} desc={desc} className="chart__svg chart__svg--wide" />
        <Plot series={sorted} start={start} end={end} w={360} h={250} font={10.5} idBase="phc-s" title={title} desc={desc} className="chart__svg chart__svg--narrow" />
      </div>
      <figcaption>
        <ul className="chart__legend">
          {sorted.map((s) => {
            const last = s.points[s.points.length - 1];
            const color = SHOP_COLORS[s.shopId] ?? "var(--ink-2)";
            return (
              <li key={s.key}>
                <svg width="28" height="10" aria-hidden="true">
                  <line x1="1" x2="27" y1="5" y2="5" stroke={color} strokeWidth="2.5"
                    strokeDasharray={s.monthly ? "1 4" : s.priceType === "通常" ? "6 4" : undefined} strokeLinecap="round" />
                </svg>
                <span className="chart__legend-name">{seriesLabel(s)}</span>
                <span className="chart__legend-val num">{last.v.toLocaleString("ja-JP")}円<small>（{last.label}）</small></span>
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}
