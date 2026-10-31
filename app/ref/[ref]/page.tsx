import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, masterRefs, monthlyHistory, publishableRefs, summarize, yen } from "@/lib/prices";
import { publishedBrandOf, publishedFamilyOfRef, refsByFamily } from "@/lib/models";
import { breadcrumb, graph, organization } from "@/lib/jsonld";
import { IconDocument, IconFigures, IconLink, IconShop, IconTable, IconTrend } from "@/components/Icons";
import { ceilingChange, fromMs, priceSeries } from "@/lib/history";
import { man, refPath, signedPct, signedYen, similarPriced } from "@/lib/insights";
import { CAMPAIGN_CEILING, SHOP_IDS, priceTypeLabel } from "@/lib/shops";
import { specFor } from "@/lib/specs";
import { pct0, retailFor, retailRatio, taxLabel } from "@/lib/retail";
import { dialComparison } from "@/lib/dials";
import { cleanModelName, conditionRows, displayName, refInfo } from "@/lib/refinfo";
import { publishedRows } from "@/lib/insights";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { ShopGapBars } from "@/components/ShopGapBars";

export function generateStaticParams() {
  return publishableRefs().map((ref) => ({ ref: ref.toLowerCase() }));
}

function resolve(param: string) {
  return publishableRefs().find((r) => r.toLowerCase() === param.toLowerCase());
}

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref: p } = await params;
  const ref = resolve(p);
  if (!ref) return { title: "該当する型番のページはありません" };
  const s = summarize(ref);
  // ブランド名を先頭に付けた表示名（lib/refinfo.ts displayName。2026-10-20 上位の買取店の title と比べて追加）
  const model = displayName(s?.models[0], masterRefs()[ref]?.brand, ref);
  // ⚠️ 以前は型番が先頭だったため、型番を知らない人には何のページか分からなかった
  //    （GSC実測 2026-09-21: 流入が型番クエリだけ・CTR 0.72%）。
  //    モデル名を先頭に出し、うちにしか出せない「店による差額」を見出しに使う。
  const ym = `${latestDate().slice(0, 4)}年${Number(latestDate().slice(5, 7))}月`;
  const gap = s?.spread ? `${s.shops.length}社で最大${yen(s.spread)}の差` : `${s?.shops.length ?? 0}社比較`;
  // ⚠️ オメガ等はモデル名が長く（例「スピードマスター Speedmaster '57 コーアクシャル…」）160字を超える（2026-10-19 precheck）。
  //    超えるときは末尾の定型文を外す。
  const body = `${model} Ref.${ref}の買取価格を、${s?.shops.length ?? 0}社の公開情報から比較しています。${s?.ceilingMin && s?.ceilingMax ? `上限額は${yen(s.ceilingMin)}〜${yen(s.ceilingMax)}で、店舗間の差額は${yen(s.spread ?? 0)}です。` : ""}`;
  const full = `${body}各社の出典リンクと取得日を明記しています。`;
  return {
    title: `${model} ${ref} 買取価格・相場｜${gap}【${ym}】| ${SITE_NAME}`,
    description: full.length <= 160 ? full : body,
    alternates: { canonical: `${SITE_URL}/ref/${ref.toLowerCase()}/` },
  };
}

export default async function RefPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref: p } = await params;
  const ref = resolve(p);
  if (!ref) notFound();
  const s = summarize(ref);
  if (!s) notFound();
  const date = latestDate();
  const history = monthlyHistory(ref);
  // ⚠️ この型番が属するモデル／ブランドのハブへ必ず繋ぐ。
  //    繋がないとハブが孤立し、作っても評価が集まらない（pilatesの店舗ページで同じ失敗をした）。
  const master = masterRefs();
  const fam = publishedFamilyOfRef(ref);
  const brand = publishedBrandOf(master[ref]?.brand);
  // ⚠️ 先頭6件を固定で出していたため、その6ページにしかリンクが集まらず、
  //    73型番がTOPからの1本だけで孤立していた（2026-09-29に判明）。
  //    並びの中で自分の前後を出して、鎖状に全型番が繋がるようにする。
  const all = publishableRefs();
  const idx = all.indexOf(ref);
  const others = all.slice(Math.max(0, idx - 3), idx + 4).filter((r) => r !== ref);
  // 価格推移（data/history）と、上限額（最高）の7日前比・30日前比（計算できる場合のみ）
  const ps = priceSeries(ref);
  const changes = [ceilingChange(ref, 7), ceilingChange(ref, 30)].filter((c): c is NonNullable<typeof c> => !!c);
  const similar = similarPriced(ref, 6);
  const shopLink = (id: string) => (SHOP_IDS as readonly string[]).includes(id) ? `/shop/${id}/` : null;
  const ceilingShopIds = new Set(s.records.filter((r) => r.price_type === "上限" || r.price_type === "相場").map((r) => r.shop_id));
  const regularOnly = [...new Set(s.records.filter((r) => !ceilingShopIds.has(r.shop_id)).map((r) => r.shop))];
  // 文字盤・仕様違いで複数の価格を公開している店（代表値は中央値）
  const splitShops = s.ceilings.filter((c) => c.splitRows).map((c) => c.shop);
  // キャンペーン加算後の「上限」を出している店（lib/shops.ts CAMPAIGN_CEILING）
  const campaignShops = [...new Set(s.records.filter((r) => r.price_type === "上限" && CAMPAIGN_CEILING[r.shop_id]).map((r) => r.shop_id))];
  // 買取店が自社ページに表示している更新日（取得日とは別。無い店は「—」）
  const pageUpdated = (v?: string | null) => {
    if (!v) return null;
    const m = v.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
  };
  const hasPageUpdated = s.records.some((r) => pageUpdated(r.page_updated));
  const spec = specFor(ref);
  // メーカー公式サイトの小売価格（data/retail・taro-2）。税込の表記はページに書かれていたときだけ
  const retail = retailFor(ref);
  const ratio = retailRatio(s, retail);
  const dials = dialComparison(s.records, master[ref]?.brand);
  // 2026-10-20 追加: 表示名（ブランド＋モデル）・型番の基本情報・状態別の上限額・同じモデルの型番（lib/refinfo.ts）
  const brandName = master[ref]?.brand;
  const name = displayName(s.models[0], brandName, ref) || "腕時計";
  const info = refInfo(s.records, brandName, ref);
  const byCond = conditionRows(s);
  const jpDate = `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
  const SAME_MODEL_MAX = 20;
  const sameModelAll = fam
    ? publishedRows()
        .filter((r) => (refsByFamily()[fam.slug] ?? []).includes(r.ref) && r.s.ceilingMax != null)
        .sort((a, b) => (b.s.ceilingMax ?? 0) - (a.s.ceilingMax ?? 0) || a.ref.localeCompare(b.ref))
    : [];
  const sameModel = sameModelAll.length >= 2
    ? (() => {
        const top = sameModelAll.slice(0, SAME_MODEL_MAX);
        const self = sameModelAll.find((r) => r.ref === ref);
        return self && !top.includes(self) ? [...top.slice(0, SAME_MODEL_MAX - 1), self] : top;
      })()
    : [];
  // variant（店の行名）から、ブランド名・型番・モデル名と重なる語を除いた「区別の語」だけを表示する
  const refKey = (t: string) => t.replace(/[./-]+/g, ".").toUpperCase();
  const variantLabel = (r: (typeof s.records)[number]) => {
    if (!r.variant) return null;
    const modelWords = new Set((r.model ?? "").split(/\s+/));
    // 文字盤・素材は複数語のこともある（例「最新型 ベンツ針」）ので語単位で持つ（丸ごとだと重複表示になる）
    const shown = new Set([r.dial, r.material].filter(Boolean).flatMap((t) => [t as string, ...(t as string).split(/\s+/)]));
    const brandWords = new Set(["ロレックス", "オメガ", "オーデマ・ピゲ", "オーデマピゲ", "ヴァシュロン・コンスタンタン", "カルティエ", "IWC", "パネライ", "ウブロ", "パテック・フィリップ", "パテックフィリップ", "チューダー", "グランドセイコー"]);
    const words = r.variant.split(/\s+/).filter((w) => w && w !== "/" && !brandWords.has(w)
      && refKey(w) !== r.ref && !modelWords.has(w) && !shown.has(w));
    return words.length ? words.join(" ") : null;
  };

  const ld = graph(
    {
      "@type": "Dataset",
      name: `${name} Ref.${ref} の買取価格比較データ`,
      description: `買取店${s.shops.length}社が公開している Ref.${ref} の買取価格を収集・比較したデータ（${date}時点）。`,
      creator: { "@id": `${SITE_URL}/#organization` },
      dateModified: date,
      url: `${SITE_URL}/ref/${ref.toLowerCase()}/`,
      variableMeasured: [
        s.ceilingMax != null ? { "@type": "PropertyValue", name: "買取上限額（最高）", value: s.ceilingMax, unitText: "JPY" } : null,
        s.ceilingMin != null ? { "@type": "PropertyValue", name: "買取上限額（最低）", value: s.ceilingMin, unitText: "JPY" } : null,
        s.spread != null ? { "@type": "PropertyValue", name: "店舗間の差額", value: s.spread, unitText: "JPY" } : null,
      ].filter(Boolean),
    },
    organization,
    // 画面の <nav> と同じ並び（ブランド・モデルは出ていない場合があるので同じ条件で落とす）
    breadcrumb([
      { name: "ホーム", path: "/" },
      ...(brand ? [{ name: brand.label, path: `/brand/${brand.slug}/` }] : []),
      ...(fam ? [{ name: fam.label, path: `/model/${fam.slug}/` }] : []),
      { name: `Ref.${ref}` },
    ]),
  );

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <div className="page-head">
        <div className="wrap-narrow page-head__inner">
          <nav className="crumbs" aria-label="パンくずリスト">
            <Link href="/">ホーム</Link>
            {brand ? (
              <>
                <span className="sep">/</span>
                <Link href={`/brand/${brand.slug}/`}>{brand.label}</Link>
              </>
            ) : null}
            {fam ? (
              <>
                <span className="sep">/</span>
                <Link href={`/model/${fam.slug}/`}>{fam.label}</Link>
              </>
            ) : null}
            <span className="sep">/</span>
            <span className="here">Ref.{ref}</span>
          </nav>

          <h1 className="page-title">
            {name} Ref.{ref} の買取価格・相場
          </h1>
          <p className="page-meta">
            更新日：<time dateTime={date}>{jpDate}</time> / 買取店{s.shops.length}社の公開情報を毎日取得して比較
          </p>
        </div>
      </div>

      <div className="wrap-narrow page-body">
      {/* 結論ボックス */}
      <section className="reveal">
        <h2 className="block-title"><IconFigures />買取価格の概要</h2>
        <div className="panel">
          <div className="figures figures--4" style={{ ["--cols" as string]: 4 }}>
            <div>
              <p className="figures__value">{s.ceilingMax != null ? yen(s.ceilingMax) : "—"}</p>
              <p className="figures__label">上限額（最高）</p>
            </div>
            <div>
              <p className="figures__value">{s.ceilingMin != null ? yen(s.ceilingMin) : "—"}</p>
              <p className="figures__label">上限額（最低）</p>
            </div>
            <div>
              <p className="figures__value">{s.spread != null ? yen(s.spread) : "—"}</p>
              <p className="figures__label">店舗間の差額</p>
            </div>
            <div>
              <p className="figures__value">{s.shops.length}社</p>
              <p className="figures__label">比較社数</p>
            </div>
          </div>
          {s.topShop && (
            <p className="summary-text">
              {date}時点で最も高い上限額を公開しているのは、<strong>{s.topShop.shop}</strong>の{yen(s.topShop.price)}
              {s.topShop.condition || s.topShop.isMedian ? `（${[s.topShop.condition, s.topShop.isMedian ? "文字盤等の違いによる複数価格の中央値" : null].filter(Boolean).join("・")}）` : ""}です。
              {s.spread != null && s.spread > 0 && <>同じ型番でも、買取店により最大{yen(s.spread)}の差があります。</>}
            </p>
          )}
        </div>
      </section>

      {/* 各社比較表 */}
      <section className="reveal">
        <h2 className="block-title"><IconTable />各社の買取価格</h2>
        <div className="table-frame">
          <table className="data-table">
            <thead>
              <tr>
                <th>買取店</th>
                <th>区分</th>
                <th>状態・仕様</th>
                <th className="r">価格</th>
                <th>取得日{hasPageUpdated && <small className="th-sub">買取店の更新日</small>}</th>
                <th>出典</th>
              </tr>
            </thead>
            <tbody>
              {s.records.map((r, i) => (
                <tr key={i}>
                  <td className="strong whitespace-nowrap">
                    {shopLink(r.shop_id) ? <a href={shopLink(r.shop_id)!}>{r.shop}</a> : r.shop}
                  </td>
                  <td className="whitespace-nowrap">
                    {r.price_type}
                    {priceTypeLabel(r.shop_id, r.price_type) !== r.price_type && <small className="cell-sub">キャンペーン加算後</small>}
                  </td>
                  {/* 同じ型番でもブレス違い等でモデル名が分かれることがある（例: 126300 の
                      オイスターブレス/ジュビリーブレス）。モデルが複数ある型番では名前を出さないと
                      「同じ状態・同じ文字盤なのに価格が違う行」に見えてしまうため、そのときだけ併記する。 */}
                  <td className="spec-cell">
                    {[s.models.length > 1 ? r.model : null, r.condition, r.dial, r.material, variantLabel(r)].filter(Boolean).join(" / ") || "—"}
                    {/* 店の表記を公式の表記に直した行（lib/prices.ts applyRowFix） */}
                    {r.fixed_note && <small className="mt-1 block text-[var(--ink-3)]">{r.fixed_note}</small>}
                    {/* 区別のつかない複数の価格を中央値1行にまとめた行（lib/prices.ts collapseUndistinguished） */}
                    {r.collapsed && (
                      <small className="mt-1 block text-[var(--ink-3)]">
                        文字盤等の違いにより複数の価格を掲載（{yen(r.collapsed.min)}〜{yen(r.collapsed.max)}）。当サイトでは中央値を表示しています。
                      </small>
                    )}
                  </td>
                  <td className="r strong">{yen(r.price_jpy)}</td>
                  {/* ⚠️ 店ごとに取得日を出す。取得元のサイトが落ちた日は直近の値を引き継ぐため、
                      全部を「今日時点」と書くと嘘になる（2026-10-02のウォッチニアン停止で発生）。 */}
                  <td className="whitespace-nowrap text-xs">
                    {!r.fetched_at ? "—"
                      : r.fetched_at === date ? r.fetched_at
                      : <strong className="text-[var(--ink)]">{r.fetched_at}</strong>}
                    {hasPageUpdated && <small className="cell-sub" title="買取店の更新日">{pageUpdated(r.page_updated) ?? "—"}</small>}
                  </td>
                  <td className="whitespace-nowrap">
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-xs">
                      公開ページ
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
        <p className="note mt-4">
          ※価格は各社の公開ページから取得したもので、取得日は買取店ごとに上表に記載しています。
          取得元のサイトを一時的に閲覧できない日は、直近で取得できた日の価格を掲載し、その取得日を表示しています。「上限」は状態が良好な場合の最大額、「相場」は各社が相場として公開している値です。実際の査定額は、個体の状態・付属品・時期により変動します。ご利用前に、各社の公開ページにて最新の価格をご確認ください。
          {hasPageUpdated && <>取得日の下の日付は「買取店の更新日」で、買取店が自社のページに表示している価格表の更新日です（表示のない買取店は「—」）。当サイトが毎日取得していても、買取店が価格表を更新していなければ同じ価格が続きます。</>}
          価格の区分や比べ方は、<a href="/guide/how-to-read-prices/">売却ガイド「時計の買取相場の見方」</a>でご説明しています。
        </p>
        {campaignShops.map((id) => (
          <p key={id} className="note mt-2">※{CAMPAIGN_CEILING[id].note}</p>
        ))}
        {splitShops.length > 0 && (
          <p className="note mt-2">
            ※{splitShops.join("・")}は、文字盤・仕様の違いにより同じ型番に複数の価格を公開しており、価格は文字盤・仕様によって異なります。
            文字盤の異なる価格どうしを比べないよう、上限額（最高）・上限額（最低）・店舗間の差額には、その買取店の価格の中央値（状態ごと）を用いています。
          </p>
        )}
      </section>

      {/* 状態別の上限額（新品・未使用・中古のうち2つ以上の価格が公開されている型番のみ・lib/refinfo.ts） */}
      {byCond && (
        <section className="reveal">
          <h2 className="block-title"><IconTable />状態別の上限額</h2>
          <div className="table-frame">
            <table className="data-table">
              <thead>
                <tr>
                  <th>状態</th>
                  <th className="r">上限額（最高）</th>
                  <th className="r">上限額（最低）</th>
                  <th>最高額の買取店</th>
                  <th className="r">社数</th>
                </tr>
              </thead>
              <tbody>
                {byCond.map((c) => (
                  <tr key={c.condition}>
                    <td className="strong whitespace-nowrap">{c.condition}</td>
                    <td className="r strong">{yen(c.max)}</td>
                    <td className="r">{c.shops > 1 ? yen(c.min) : "—"}</td>
                    <td className="whitespace-nowrap">{c.maxShop}</td>
                    <td className="r">{c.shops}社</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note mt-4">
            ※各社が状態（新品・未使用・中古）を分けて公開している上限額・相場を、状態ごとにまとめています（文字盤・仕様違いで複数の価格がある買取店は、その中央値）。状態の基準は買取店により異なり、状態ごとに価格を公開している買取店の顔ぶれも異なるため、状態どうしの差には買取店の違いによる差が含まれます。
          </p>
        </section>
      )}

      {/* 店舗間の差額（横棒）。上限・相場の価格を出している店が2社以上ある場合のみ */}
      {ceilingShopIds.size >= 2 && (
        <section className="reveal">
          <h2 className="block-title"><IconShop />店舗間の差額</h2>
          <ShopGapBars records={s.records} />
          <p className="note mt-4">
            ※各社が公開している上限額・相場を1社1本で表示しています（文字盤・仕様違いで複数の価格がある買取店は、その中央値）。棒の長さは、最も高い価格を100%とした割合です。
            {regularOnly.length > 0 && <>{regularOnly.join("・")}は通常の買取価格のみを公開しているため、この図には含めていません（各社の価格は上表に記載しています）。</>}
            {campaignShops.length > 0 && <>「{CAMPAIGN_CEILING[campaignShops[0]].label}」と表示している{campaignShops.map((id) => s.records.find((r) => r.shop_id === id)!.shop).join("・")}の棒は、キャンペーンによる加算を含む金額です。</>}
          </p>
        </section>
      )}

      {/* 文字盤別の比較（同じ文字盤の価格を2社以上が出している場合のみ・lib/dials.ts） */}
      {dials && (
        <section className="reveal">
          <h2 className="block-title"><IconTable />文字盤別の比較</h2>
          <p className="prose-jp mb-5">
            文字盤の色ごとに価格を公開している買取店について、同じ文字盤どうしで上限額・相場を比べています。文字盤の表記は買取店により異なるため、同じ色を指す表記（例：「BK」「黒」「ブラック」）は1つにまとめています。
          </p>
          <div className="table-frame">
            <table className="data-table dial-table">
              <thead>
                <tr>
                  <th>文字盤</th>
                  {dials.shops.map((sh) => <th key={sh.id} className="r">{sh.name}</th>)}
                  <th className="r">差額<small className="th-sub">最高／最低</small></th>
                </tr>
              </thead>
              <tbody>
                {dials.rows.map((row) => (
                  <tr key={row.dial}>
                    <td className="whitespace-nowrap strong">
                      {row.dial}
                      {row.rawNames.length > 0 && <small className="dial-table__raw">表記：{row.rawNames.join("・")}</small>}
                    </td>
                    {dials.shops.map((sh) => {
                      const c = row.cells[sh.id];
                      return (
                        <td key={sh.id} className={`r${c && c.price === row.max ? " strong" : ""}`}>
                          {c ? (
                            <>
                              {yen(c.price)}
                              <small className="dial-table__sub">
                                {[c.price_type === "相場" ? "相場" : null, priceTypeLabel(sh.id, c.price_type) !== c.price_type ? "加算後" : null, c.condition, c.n > 1 ? `${c.n}件の中央値` : null].filter(Boolean).join("・")}
                              </small>
                            </>
                          ) : "—"}
                        </td>
                      );
                    })}
                    <td className="r strong">
                      {row.gap > 0 ? yen(row.gap) : "0円"}
                      <small className="dial-table__sub">{yen(row.max)}／{yen(row.min)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
          <p className="note mt-4">
            ※対象は区分「上限」「相場」の価格で、文字盤の記載がある行だけです（価格の下に「相場」と記載のないものは「上限」。「加算後」はキャンペーンによる加算後の上限です）。同じ買取店に同じ文字盤の価格が複数ある場合は、状態ごとの中央値のうち最も高いものを表示しています。右端の「差額」は、その文字盤の価格を公開している買取店どうしの最高額と最低額の差で、下段に最高額／最低額を記載しています。
            {dials.rows.some((r) => r.dial === "GR") && "「GR」は買取店の略記のまま掲載しています（この型番では文字盤の色を確定できないため）。"}
          </p>
        </section>
      )}

      {/* 価格推移（日次の記録がある場合のみ） */}
      {ps && ps.series.length > 0 && (
        <section className="reveal">
          <h2 className="block-title"><IconTrend />買取価格の推移</h2>
          <p className="prose-jp mb-5">
            当サイトでは、各社の公開価格を毎日取得して記録しています。Ref.{ref}の記録は{fromMs(ps.start)}から{fromMs(ps.end)}までです。実線は上限額、破線は通常の買取価格、点線は相場（月ごとの相場として公開され、その日に掲載されていた値）を表しています。
          </p>
          <PriceHistoryChart series={ps.series} start={ps.start} end={ps.end} refLabel={`Ref.${ref}`} />
          {changes.length > 0 && (
            <dl className="delta-list">
              {changes.map((c) => (
                <div key={c.days}>
                  <dt>上限額（最高）の{c.days}日前比</dt>
                  <dd className={c.diff > 0 ? "up" : c.diff < 0 ? "down" : ""}>
                    {signedYen(c.diff)}（{signedPct(c.pct)}）
                    <small>
                      <span className="nobr">{c.then.date}：{yen(c.then.max)}（{c.then.shop}）</span>→<span className="nobr">{c.now.date}：{yen(c.now.max)}（{c.now.shop}）</span>
                    </small>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="note mt-4">
            ※日次の値は、各社が取得日に公開していた価格のうち区分ごとに最も高いものです（文字盤・仕様違いで複数の価格がある買取店は、状態ごとの中央値のうち最も高いもの）。取得できなかった期間は線を途切れさせています。
            {changes.some((c) => !c.sameShops) && "比較している期間に、上限額・相場を公開している買取店の顔ぶれが変わっているため、増減には掲載店の入れ替わりによる差が含まれます。"}
            {changes.length === 0 && "記録の期間が短いため、7日前比・30日前比は表示していません。"}
          </p>
        </section>
      )}

      {/* 月次推移(データがある場合のみ) */}
      {history.length >= 2 && (
        <section className="reveal">
          <h2 className="block-title"><IconTrend />買取相場の推移（月次）</h2>
          <div className="table-frame">
            <table className="data-table">
              <thead>
                <tr>
                  <th>年月</th>
                  <th className="r">相場</th>
                  <th className="r">前月比</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(-12).map((h, i, arr) => {
                  const prev = i > 0 ? arr[i - 1].price : null;
                  const diff = prev != null ? h.price - prev : null;
                  return (
                    <tr key={h.month}>
                      <td>{h.month}</td>
                      <td className="r strong">{yen(h.price)}</td>
                      <td className={`r ${diff == null ? "" : diff > 0 ? "up" : diff < 0 ? "down" : ""}`}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toLocaleString("ja-JP")}円`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note mt-4">
            ※月次の相場推移は、
            <a href={history[0].source_url} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--silver-2)] underline-offset-2">出典元</a>
            が公開している履歴データにもとづいています。
          </p>
        </section>
      )}

      {/* メーカー公式サイトの小売価格（data/retail）。買取価格とは日付も出典も違うので、割合は参考値として注記する */}
      {retail && (
        <section className="reveal" id="retail">
          <h2 className="block-title"><IconFigures />メーカーの小売価格と買取価格</h2>
          <div className="panel">
            <div className="figures figures--3" style={{ ["--cols" as string]: ratio != null ? 3 : 1 }}>
              <div>
                <p className="figures__value">{yen(retail.latest.price_jpy)}</p>
                <p className="figures__label">公式サイトの表示価格{taxLabel(retail.latest)}</p>
              </div>
              {ratio != null && (
                <>
                  <div>
                    <p className="figures__value">{yen(s.ceilingMax as number)}</p>
                    <p className="figures__label">上限額（最高）</p>
                  </div>
                  <div>
                    <p className="figures__value">{pct0(ratio)}</p>
                    <p className="figures__label">小売価格に対する上限額（最高）の割合</p>
                  </div>
                </>
              )}
            </div>
            <p className="summary-text">
              メーカー公式サイトの型番ページには、{retail.latest.as_of}時点で{yen(retail.latest.price_jpy)}{taxLabel(retail.latest)}と表示されていました（
              {retail.latest.archive ? (
                <>
                  <a href={retail.latest.archive} target="_blank" rel="noopener noreferrer">{retail.latest.snapshot ?? retail.latest.as_of}時点の保存版</a>
                  ・<a href={retail.latest.url} target="_blank" rel="noopener noreferrer">公式ページ</a>
                </>
              ) : (
                <a href={retail.latest.url} target="_blank" rel="noopener noreferrer">公式ページ</a>
              )}
              ）。
              {ratio != null && <>{date}時点の上限額（最高）{yen(s.ceilingMax as number)}は、この価格の{pct0(ratio)}にあたります。</>}
            </p>
          </div>

          {retail.points.length >= 2 && (
            <>
              <h3 className="sub-title mt-8 mb-3">公式サイトの表示価格の推移</h3>
              <div className="table-frame">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>確認日</th>
                      <th className="r">表示価格</th>
                      <th className="r">前回からの改定</th>
                      <th>出典</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retail.points.map((pt, i, arr) => {
                      const prev = i > 0 ? arr[i - 1].price_jpy : null;
                      const diff = prev != null ? pt.price_jpy - prev : null;
                      return (
                        <tr key={`${pt.as_of}-${i}`}>
                          <td className="whitespace-nowrap">{pt.as_of}</td>
                          <td className="r strong">{yen(pt.price_jpy)}{pt.tax_included === true && <small className="cell-sub">消費税込</small>}</td>
                          <td className={`r whitespace-nowrap ${diff == null ? "" : diff > 0 ? "up" : diff < 0 ? "down" : ""}`}>
                            {diff == null ? "—" : diff === 0 ? "変更なし" : <>{signedYen(diff)}<small className="cell-sub">{signedPct(diff / (prev as number))}</small></>}
                          </td>
                          <td className="whitespace-nowrap text-xs">
                            {pt.archive ? (
                              <a href={pt.archive} target="_blank" rel="noopener noreferrer">保存版{pt.snapshot && pt.snapshot !== pt.as_of ? `（${pt.snapshot}）` : ""}</a>
                            ) : (
                              <a href={pt.url} target="_blank" rel="noopener noreferrer">公式ページ</a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
            </>
          )}

          <p className="note mt-4">
            ※「公式サイトの表示価格」は、メーカー公式サイトの型番ページ（またはインターネット上の保存版）に表示されていた日本円の価格です。消費税込の表記がある場合だけ「（消費税込）」と記載しています。日本円の価格が表示されていない時点の値は掲載しておりません。
            {retail.points.length >= 2 && "推移の表の確認日は、公式ページまたは保存版でその価格を確認できた日であり、価格が改定された日ではありません。改定は、前回の確認日からその確認日までの間に行われています。"}
            {ratio != null && <>「小売価格に対する上限額（最高）の割合」は、上限額（最高）を最新の公式サイトの表示価格で割った値です。小売価格（{retail.latest.as_of}時点・メーカー公式サイト）と買取価格（{date}時点・各買取店の公開ページ）は日付も出典も異なるため、この割合は参考値としてご覧ください。</>}
          </p>
        </section>
      )}

      {/* 型番の基本情報（買取店の公開ページの表記から・lib/refinfo.ts） */}
      <section className="reveal" id="ref-info">
        <h2 className="block-title"><IconDocument />Ref.{ref}の基本情報</h2>
        <dl className="kv">
          {brandName && (
            <>
              <dt>ブランド</dt>
              <dd>{brand ? <a href={`/brand/${brand.slug}/`}>{brandName}</a> : brandName}</dd>
            </>
          )}
          {fam && (
            <>
              <dt>モデル</dt>
              <dd><a href={`/model/${fam.slug}/`}>{fam.label}</a></dd>
            </>
          )}
          <dt>型番</dt>
          <dd className="num">Ref.{ref}</dd>
          {info.names.length > 0 && (
            <>
              <dt>買取店での掲載名</dt>
              <dd>
                {info.names.map((n, i) => (
                  <Fragment key={n.name}>
                    {i > 0 && "、"}
                    {n.name}<small className="text-[var(--ink-3)]">（{n.shops.join("・")}）</small>
                  </Fragment>
                ))}
              </dd>
            </>
          )}
          {info.dials.length > 0 && (
            <>
              <dt>買取店が記載している文字盤</dt>
              <dd>{info.dials.join("・")}</dd>
            </>
          )}
          {info.materials.length > 0 && (
            <>
              <dt>買取店が記載している素材</dt>
              <dd>{info.materials.join("・")}</dd>
            </>
          )}
          {info.conditions.length > 0 && (
            <>
              <dt>買取店が記載している状態</dt>
              <dd>{info.conditions.join("・")}</dd>
            </>
          )}
          <dt>比較している買取店</dt>
          <dd>{s.shops.join("・")}（{s.shops.length}社）</dd>
        </dl>
        <p className="note mt-4">
          ※買取店での掲載名・文字盤・素材・状態は、各買取店が公開ページに記載している表記をもとにしています（ブランド名と型番は除いています。文字盤は同じ色を指す表記を1つにまとめています）。
          {spec ? "メーカー公式サイトに記載のある仕様は、下の「基本仕様（メーカー公式）」に掲載しています。" : "この型番は、メーカー公式サイトで仕様を確認できなかったため、公式の仕様は掲載しておりません。"}
        </p>
      </section>

      {/* メーカー公式の基本仕様（data/specs・taro-2）。英語ページが出典の型番は数値・固有名詞だけ */}
      {spec && (
        <section className="reveal">
          <h2 className="block-title"><IconDocument />基本仕様（メーカー公式）</h2>
          <dl className="kv">
            {spec.rows.map((r, i) => (
              <Fragment key={i}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </Fragment>
            ))}
            {spec.status && (
              <>
                <dt>掲載状況</dt>
                <dd>{spec.status}</dd>
              </>
            )}
          </dl>
          <p className="note mt-4">
            ※出典：
            <a href={spec.source.url} target="_blank" rel="noopener noreferrer">メーカー公式サイトの型番ページ</a>
            {spec.source.archive && (
              <>（<a href={spec.source.archive} target="_blank" rel="noopener noreferrer">{spec.source.snapshot ? `${spec.source.snapshot}時点の保存版` : "保存版"}</a>）</>
            )}
            {spec.source.checked && <>・{spec.source.checked}確認</>}。
            {spec.english && "出典が英語のページのため、数値と固有名詞の項目のみを掲載しています。"}
            公式サイトに記載のない項目は掲載しておりません。
          </p>
        </section>
      )}

      {/* 高く売るための実務ポイント(データから導ける事実のみ) */}
      <section className="reveal">
        <h2 className="block-title"><IconDocument />掲載データについて</h2>
        <ul className="plain-list">
          <li>掲載額は、各社が公開している「買取価格」です。実際の査定額は、個体差（傷・付属品・保証書の有無）により上下します。</li>
          {s.spread != null && s.spread > 0 && (
            <li>同じ型番でも公開額に{yen(s.spread)}の差があるため、売却の際は複数社の査定額を比較されることをおすすめします。</li>
          )}
          <li>文字盤の色や素材により価格が分かれる型番があります。上表で仕様を明記している行は、その条件での価格です。</li>
          <li>価格を毎日更新する買取店もあるため、当サイトでも日次で取得し直しています（最終取得日：{date}）。</li>
        </ul>
      </section>

      {sameModel.length >= 2 && fam && (
        <section className="reveal">
          <h2 className="block-title"><IconLink />{fam.label}の型番別の買取価格</h2>
          <p className="prose-jp mb-5">
            当サイトで掲載している{fam.label}の型番{sameModelAll.length}件を、上限額（最高）の高い順に掲載しています（{jpDate}時点）。
            {sameModelAll.length > sameModel.length && <>上位{SAME_MODEL_MAX}件まで掲載しています。すべての型番は<a href={`/model/${fam.slug}/`}>{fam.label}の買取相場</a>でご覧いただけます。</>}
          </p>
          <div className="table-frame">
            <table className="data-table">
              <thead>
                <tr>
                  <th>型番</th>
                  <th>モデル名</th>
                  <th className="r">上限額（最高）</th>
                  <th className="r">比較社数</th>
                </tr>
              </thead>
              <tbody>
                {sameModel.map((r) => (
                  <tr key={r.ref}>
                    <td className="whitespace-nowrap num strong">
                      {r.ref === ref ? <>Ref.{r.ref}<small className="cell-sub">このページ</small></> : <a href={refPath(r.ref)}>Ref.{r.ref}</a>}
                    </td>
                    <td>{cleanModelName(r.model, r.brand, r.ref) || "—"}</td>
                    <td className="r strong">{yen(r.s.ceilingMax as number)}</td>
                    <td className="r">{r.s.shops.length}社</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
        </section>
      )}

      {similar.length > 0 && s.ceilingMax != null && (
        <section className="reveal">
          <h2 className="block-title"><IconLink />同じ価格帯の型番</h2>
          <p className="prose-jp mb-5">
            上限額（最高）が{man(s.ceilingMax)}の前後15%（{man(Math.round(s.ceilingMax * 0.85))}〜{man(Math.round(s.ceilingMax * 1.15))}）に入る、他のモデルの型番です。
          </p>
          <div className="ref-cards">
            {similar.map((r) => (
              <a key={r.ref} href={refPath(r.ref)} className="ref-card">
                <span className="ref-card__ref num">Ref.{r.ref}</span>
                <span className="ref-card__model">{r.brand} {r.model}</span>
                <span className="ref-card__price">上限額（最高） {yen(r.s.ceilingMax as number)}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="reveal">
        <h2 className="block-title"><IconLink />関連ページ</h2>
        <div className="chip-row">
          {brand && <a href={`/brand/${brand.slug}/`} className="btn btn-sm">{brand.label}の買取相場</a>}
          {fam && <a href={`/model/${fam.slug}/`} className="btn btn-sm">{fam.label}の買取相場</a>}
          <a href="/ranking/" className="btn btn-sm">買取価格ランキング</a>
          <a href="/guide/how-to-read-prices/" className="btn btn-sm">売却ガイド：相場の見方</a>
          <a href="/faq/" className="btn btn-sm">よくある質問</a>
          {[...new Set(s.records.map((r) => r.shop_id))]
            .filter((id) => shopLink(id))
            .map((id) => (
              <a key={id} href={shopLink(id)!} className="btn btn-sm">{s.records.find((r) => r.shop_id === id)!.shop}の掲載データ</a>
            ))}
        </div>
      </section>

      {others.length > 0 && (
        <section className="reveal">
          <h2 className="block-title"><IconLink />他の型番の買取価格</h2>
          <div className="chip-row">
            {others.map((r) => (
              <a key={r} href={`/ref/${r.toLowerCase()}/`} className="btn btn-sm num">
                Ref.{r}
              </a>
            ))}
          </div>
        </section>
      )}
      </div>
    </main>
  );
}
