import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, yen } from "@/lib/prices";
import { publishedRows, refPath, shopStats } from "@/lib/insights";
import { loadEditorial } from "@/lib/content";
import { CAPTURED_ON } from "@/lib/shops";
import { breadcrumb, graph, itemList, organization } from "@/lib/jsonld";
import { EditorialSection } from "@/components/EditorialSection";
import { IconFigures, IconLink, IconShop, IconTable } from "@/components/Icons";

/*
  買取店ごとのページ（/shop/<shop_id>/）。
  ⚠️ フェーズ1はデータのみ。数値はすべて、公開中の型番について summarize() の実レコードから集計する。
  ⚠️ 解説文は content/shops/<shop_id>.md がある場合だけ表示する（無ければ何も出さない）。
*/

export const dynamicParams = false;

export function generateStaticParams() {
  return shopStats().map((s) => ({ id: s.id }));
}

function ym(d: string) {
  return `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const st = shopStats().find((s) => s.id === id);
  if (!st) return { title: "ページが見つかりません" };
  const d = latestDate();
  return {
    title: `${st.name}の買取価格データ｜掲載${st.refs.length}型番・最高額${st.topRefs.length}型番【${ym(d)}】| ${SITE_NAME}`,
    description: `${st.name}が公開している腕時計の買取価格について、当サイトが比較している型番のうち${st.refs.length}型番の掲載状況と、上限額が各社で最も高い型番（${st.topRefs.length}型番）を${d}時点でまとめています。`,
    alternates: { canonical: `${SITE_URL}/shop/${id}/` },
  };
}

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const st = shopStats().find((s) => s.id === id);
  if (!st) notFound();
  const date = latestDate();
  const total = publishedRows().length;
  const editorial = loadEditorial("shops", id);
  const others = shopStats().filter((s) => s.id !== id);
  const rate = st.ceilingRefs ? Math.round((st.topRefs.length / st.ceilingRefs) * 1000) / 10 : null;
  const refsSorted = [...st.refs].sort((a, b) => a.ref.localeCompare(b.ref));

  const ld = graph(
    {
      "@type": "WebPage",
      name: `${st.name}の買取価格データ`,
      url: `${SITE_URL}/shop/${id}/`,
      dateModified: date,
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
    organization,
    breadcrumb([{ name: "ホーム", path: "/" }, { name: st.name }]),
    itemList(`${st.name}の上限額が最も高い型番`, st.topRefs.map((r) => ({ name: `Ref.${r.ref}`, path: refPath(r.ref) }))),
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
              <span className="here">{st.name}</span>
            </nav>
            <h1 className="page-title">{st.name}の買取価格データ</h1>
            <p className="page-meta">{date}時点 / 当サイト掲載{total}型番のうち{st.refs.length}型番に価格を掲載</p>
          </div>
        </div>

        <div className="wrap-narrow page-body">
          <section className="reveal">
            <h2 className="block-title"><IconFigures />掲載状況の概要</h2>
            <div className="panel">
              <div className="figures figures--4" style={{ ["--cols" as string]: 4 }}>
                <div>
                  <p className="figures__value">{st.refs.length}</p>
                  <p className="figures__label">掲載型番</p>
                </div>
                <div>
                  <p className="figures__value">{st.topRefs.length}</p>
                  <p className="figures__label">上限額が最も高い型番</p>
                </div>
                <div>
                  <p className="figures__value">{rate != null ? `${rate}%` : "—"}</p>
                  <p className="figures__label">最高額の割合</p>
                </div>
                <div>
                  <p className="figures__value">{st.brands.length}</p>
                  <p className="figures__label">ブランド</p>
                </div>
              </div>
              <p className="summary-text">
                当サイトでは、{st.name}が自社サイトで公開している買取価格を毎日取得しています。{date}時点で当サイトに掲載している{total}型番のうち、{st.name}の価格を掲載しているのは{st.refs.length}型番です。
                {st.ceilingRefs > 0
                  ? <>上限額・相場を公開している{st.ceilingRefs}型番のうち、{st.topRefs.length}型番で比較各社の中で最も高い価格（同額を含む）を公開しています。</>
                  : <>{st.name}は通常の買取価格のみを公開しているため、上限額の比較には含めていません。</>}
              </p>
            </div>
          </section>

          <section className="reveal">
            <h2 className="block-title"><IconShop />掲載データの内容</h2>
            <dl className="kv">
              <dt>掲載ブランド</dt>
              <dd>{st.brands.join("・") || "—"}</dd>
              <dt>価格の区分</dt>
              <dd>{st.types.join("・")}</dd>
              <dt>取得元のページ</dt>
              <dd>
                {st.sourceUrls.map((u, i) => (
                  <span key={u}>{i > 0 && <br />}<a href={u} target="_blank" rel="noopener noreferrer">{u}</a></span>
                ))}
              </dd>
              {st.officialUrl && (
                <>
                  <dt>公式サイト</dt>
                  <dd><a href={st.officialUrl} target="_blank" rel="noopener noreferrer">{st.name} 公式サイト（買取価格のページ）</a></dd>
                </>
              )}
            </dl>
            <p className="note mt-4">
              ※「上限」は状態が良好な場合の最大額、「通常」は通常の買取価格、「相場」は各社が相場として公開している値です。区分は各社の公開ページの表記にもとづいています。
            </p>
            {st.image && (
              <figure className="shop-shot mt-8">
                <img src={st.image} alt={`${st.name}の公式サイト（買取価格のページ）`} width={1280} height={800} loading="lazy" decoding="async" />
                <figcaption>出典：{st.name} 公式サイト（{CAPTURED_ON}時点）</figcaption>
              </figure>
            )}
          </section>

          <EditorialSection data={editorial} heading={editorial?.title ? undefined : `${st.name}について`} />

          <section className="reveal">
            <h2 className="block-title"><IconTable />{st.name}の上限額が最も高い型番</h2>
            {st.topRefs.length ? (
              <>
                <div className="table-frame">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>型番</th>
                        <th className="hide-sm">モデル</th>
                        <th className="r">上限額（最高）</th>
                        <th className="r">店舗間の差額</th>
                        <th className="r">比較社数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {st.topRefs.map((r) => (
                        <tr key={r.ref}>
                          <td className="whitespace-nowrap"><a href={refPath(r.ref)}>{r.ref}</a><span className="sub-sm">{r.brand} {r.model}</span></td>
                          <td className="model hide-sm">{r.brand} {r.model}</td>
                          <td className="r strong">{yen(r.s.ceilingMax as number)}</td>
                          <td className="r">{r.s.spread ? yen(r.s.spread) : "—"}</td>
                          <td className="r">{r.s.shops.length}社</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
              </>
            ) : (
              <p className="prose-jp">{date}時点で、{st.name}の価格が比較各社の中で最も高い型番はありません。</p>
            )}
          </section>

          <section className="reveal">
            <h2 className="block-title"><IconLink />{st.name}の価格を掲載している型番</h2>
            <div className="chip-row">
              {refsSorted.map((r) => (
                <a key={r.ref} href={refPath(r.ref)} className="btn btn-sm num">Ref.{r.ref}</a>
              ))}
            </div>
          </section>

          <section className="reveal">
            <h2 className="block-title"><IconLink />他の買取店</h2>
            <div className="chip-row">
              {others.map((o) => (
                <a key={o.id} href={`/shop/${o.id}/`} className="btn btn-sm">{o.name}</a>
              ))}
              <a href="/ranking/" className="btn btn-sm">買取価格ランキング</a>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
