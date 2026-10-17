import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, yen } from "@/lib/prices";
import { publishedRows, refPath, signedPct, signedYen, topCeiling, topDown, topRetailRatio, topSpread, topUp, type MoveRow, type RefRow, type RetailRow } from "@/lib/insights";
import { pct0, taxLabel } from "@/lib/retail";
import { breadcrumb, graph, itemList, organization } from "@/lib/jsonld";
import { IconFigures, IconLink, IconTable, IconTrend } from "@/components/Icons";

/*
  買取価格ランキング（/ranking/）。
  ⚠️ 対象は公開中の型番だけ。数値は型番ページと同じ summarize() と data/history の実レコード。
  ⚠️ 7日間の増減は、上限額・相場を公開している店の顔ぶれが7日前と同じ型番に限る
     （店の掲載開始・終了による見かけの増減を載せない）。
*/

function ym(d: string) {
  return `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月`;
}

export function generateMetadata(): Metadata {
  const d = latestDate();
  return {
    title: `時計の買取価格ランキング｜店舗間の差額・上限額の変動【${ym(d)}】| ${SITE_NAME}`,
    description: `腕時計の型番別買取価格を、店舗間の差額が大きい順、直近7日間の上限額の変動、上限額の高い順に掲載しています。${d}時点で当サイトが比較している${publishedRows().length}型番の公開価格から集計しています。`,
    alternates: { canonical: `${SITE_URL}/ranking/` },
  };
}

function RefTable({ rows, kind }: { rows: (RefRow | MoveRow | RetailRow)[]; kind: "spread" | "ceiling" | "move" | "retail" }) {
  return (
    <>
      <div className="table-frame">
        <table className="data-table">
          <thead>
            <tr>
              <th className="rank">順位</th>
              <th>型番</th>
              <th className="hide-sm">モデル</th>
              {kind === "spread" && (<><th className="r">店舗間の差額</th><th className="r">上限額（最高）</th><th className="r">上限額（最低）</th></>)}
              {kind === "ceiling" && (<><th className="r">上限額（最高）</th><th>最高額の買取店</th><th className="r">比較社数</th></>)}
              {kind === "move" && (<><th className="r">7日前比</th><th className="r">7日前</th><th className="r">最新</th></>)}
              {kind === "retail" && (<><th className="r">割合<small className="th-sub">上限額（最高）÷小売価格</small></th><th className="r">上限額（最高）</th><th className="r">公式サイトの表示価格</th></>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.ref}>
                <td className="rank num">{i + 1}</td>
                <td className="whitespace-nowrap"><a href={refPath(r.ref)}>{r.ref}</a><span className="sub-sm">{r.brand} {r.model}</span></td>
                <td className="model hide-sm">{r.brand} {r.model}</td>
                {kind === "spread" && (
                  <>
                    <td className="r strong">{yen(r.s.spread ?? 0)}</td>
                    <td className="r">{r.s.ceilingMax != null ? yen(r.s.ceilingMax) : "—"}</td>
                    <td className="r">{r.s.ceilingMin != null ? yen(r.s.ceilingMin) : "—"}</td>
                  </>
                )}
                {kind === "ceiling" && (
                  <>
                    <td className="r strong">{r.s.ceilingMax != null ? yen(r.s.ceilingMax) : "—"}</td>
                    <td className="whitespace-nowrap">{r.s.topShop?.shop ?? "—"}</td>
                    <td className="r">{r.s.shops.length}社</td>
                  </>
                )}
                {kind === "retail" && "ratio" in r && (
                  <>
                    <td className="r strong">{pct0(r.ratio)}</td>
                    <td className="r">{yen(r.s.ceilingMax as number)}</td>
                    <td className="r">{yen(r.retail.latest.price_jpy)}{taxLabel(r.retail.latest)}<br /><span className="text-xs">{r.retail.latest.as_of}時点</span></td>
                  </>
                )}
                {kind === "move" && "c" in r && (
                  <>
                    <td className={`r strong ${r.c.diff > 0 ? "up" : "down"}`}>{signedYen(r.c.diff)}（{signedPct(r.c.pct)}）</td>
                    <td className="r">{yen(r.c.then.max)}<br /><span className="text-xs">{r.c.then.date}</span></td>
                    <td className="r">{yen(r.c.now.max)}<br /><span className="text-xs">{r.c.now.date}</span></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
    </>
  );
}

export default function RankingPage() {
  const date = latestDate();
  const total = publishedRows().length;
  const spread = topSpread(20);
  const up = topUp(10);
  const down = topDown(10);
  const ceiling = topCeiling(20);
  const retail = topRetailRatio(20);
  const sections = [
    { id: "spread", title: "店舗間の差額が大きい型番", rows: spread },
    { id: "up", title: "直近7日で上限額が上がった型番", rows: up },
    { id: "down", title: "直近7日で上限額が下がった型番", rows: down },
    { id: "ceiling", title: "上限額が高い型番", rows: ceiling },
    ...(retail.length ? [{ id: "retail", title: "小売価格に対する上限額（最高）の割合が高い型番", rows: retail }] : []),
  ];

  const ld = graph(
    {
      "@type": "WebPage",
      name: "時計の買取価格ランキング",
      url: `${SITE_URL}/ranking/`,
      dateModified: date,
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
    organization,
    breadcrumb([{ name: "ホーム", path: "/" }, { name: "買取価格ランキング" }]),
    // 画面に並んでいる表と同じ行・同じ順番
    ...sections.map((sec) => itemList(sec.title, sec.rows.map((r) => ({ name: `Ref.${r.ref} ${r.model}`.trim(), path: refPath(r.ref) })))),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main>
        <div className="page-head">
          <div className="wrap-narrow page-head__inner">
            <nav className="crumbs" aria-label="パンくずリスト">
              <Link href="/">ホーム</Link>
              <span className="sep">/</span>
              <span className="here">買取価格ランキング</span>
            </nav>
            <h1 className="page-title">時計の買取価格ランキング</h1>
            <p className="page-meta">{date}時点 / 掲載{total}型番から集計</p>
          </div>
        </div>

        <div className="wrap-narrow page-body">
          <section className="reveal">
            <h2 className="block-title"><IconFigures />ランキングの概要</h2>
            <p className="prose-jp">
              当サイトでは、買取店が公開している型番別の買取価格を毎日取得し、{date}時点で{total}型番を掲載しています。{"このページでは、同じ型番における店舗間の差額、直近7日間の上限額（最高）の変動、上限額（最高）の高さの3つの観点で型番を並べています。"}
              {retail.length > 0 && "あわせて、メーカー公式サイトの小売価格がわかる型番について、小売価格に対する上限額（最高）の割合が高い順にも並べています。"}
              {"各型番の名称から"}、買取店ごとの価格と出典をご確認いただけます。
            </p>
            <nav className="rank-nav mt-6" aria-label="ランキングの項目">
              {sections.map((sec) => (
                <a key={sec.id} href={`#${sec.id}`} className="btn btn-sm">{sec.title}</a>
              ))}
            </nav>
          </section>

          <section className="reveal" id="spread">
            <h2 className="block-title"><IconTable />店舗間の差額が大きい型番</h2>
            <p className="subnote mb-4">上限額・相場として公開されている価格（買取店ごとの代表値）のうち、最も高い価格と最も低い価格の差が大きい順に{spread.length}型番を掲載しています。</p>
            <RefTable rows={spread} kind="spread" />
          </section>

          <section className="reveal" id="up">
            <h2 className="block-title"><IconTrend />直近7日で上限額が上がった型番</h2>
            <p className="subnote mb-4">上限額（最高）の7日前からの上昇率が大きい順に掲載しています。</p>
            {up.length ? <RefTable rows={up} kind="move" /> : <p className="prose-jp">直近7日間で上限額（最高）が上がった型番はありません。</p>}
          </section>

          <section className="reveal" id="down">
            <h2 className="block-title"><IconTrend />直近7日で上限額が下がった型番</h2>
            <p className="subnote mb-4">上限額（最高）の7日前からの下落率が大きい順に掲載しています。</p>
            {down.length ? <RefTable rows={down} kind="move" /> : <p className="prose-jp">直近7日間で上限額（最高）が下がった型番はありません。</p>}
          </section>

          <section className="reveal" id="ceiling">
            <h2 className="block-title"><IconTable />上限額が高い型番</h2>
            <p className="subnote mb-4">上限額（最高）が高い順に{ceiling.length}型番を掲載しています。</p>
            <RefTable rows={ceiling} kind="ceiling" />
          </section>

          {retail.length > 0 && (
            <section className="reveal" id="retail">
              <h2 className="block-title"><IconTable />小売価格に対する上限額（最高）の割合が高い型番</h2>
              <p className="subnote mb-4">上限額（最高）を、メーカー公式サイトの型番ページに表示されている最新の価格（公式サイトの表示価格）で割った割合が高い順に{retail.length}型番を掲載しています。対象は、公式サイトの表示価格を確認できた掲載中の型番です。</p>
              <RefTable rows={retail} kind="retail" />
              <p className="note mt-4">
                ※公式サイトの表示価格は、メーカー公式サイトの型番ページ（またはインターネット上の保存版）に表示されていた日本円の価格で、表の下段はその確認日です。消費税込の表記がある場合だけ「（消費税込）」と記載しています。小売価格（メーカー公式サイト）と買取価格（{date}時点・各買取店の公開ページ）は日付も出典も異なるため、この割合は参考値としてご覧ください。小売価格の推移と出典は、各型番のページに掲載しています。
              </p>
            </section>
          )}

          <section className="reveal">
            <p className="note">
              ※各社が公開している買取価格を{date}までに取得したものです。「上限額（最高）」は、区分「上限」「相場」の価格について買取店ごとの代表値（同じ買取店が文字盤・仕様の違いにより複数の価格を公開している場合は状態ごとの中央値）を求め、そのうち最も高いものです。7日前比は、上限額・相場を公開している買取店の顔ぶれが7日前と同じ型番だけを対象にしています（掲載店の入れ替わりによる増減は含めていません）。実際の査定額は、個体の状態・付属品・時期により変動します。
            </p>
          </section>

          <section className="reveal">
            <h2 className="block-title"><IconLink />関連ページ</h2>
            <div className="chip-row">
              <a href="/#brands" className="btn btn-sm">ブランドから探す</a>
              <a href="/#models" className="btn btn-sm">モデルから探す</a>
              <a href="/#shops" className="btn btn-sm">比較している買取店</a>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
