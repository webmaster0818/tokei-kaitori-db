import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { latestDate, publishableRefs, summarize, yen } from "@/lib/prices";
import { BRANDS, FAMILIES, refsByBrand, refsByFamily } from "@/lib/models";
import { graph, itemList, organization } from "@/lib/jsonld";
import { masterRefs } from "@/lib/prices";
import { CAPTURED_ON, SHOP_PAGES } from "@/lib/shops";
import { RefSearch } from "@/components/RefSearch";
import { SectionHead } from "@/components/SectionHead";
import { Arrow, IconBrand, IconDocument, IconFigures, IconSearch, IconShop, IconTable, IconTrend, IconWatch } from "@/components/Icons";
import { topSpread } from "@/lib/insights";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "腕時計の型番ごとの買取価格を、買取店が公開している価格から毎日収集して比較しています。同じ型番における店舗間の差額を、出典リンクと取得日を併記して掲載しています。",
  alternates: { canonical: `${SITE_URL}/` },
};

export default function Home() {
  const date = latestDate();
  const rows = publishableRefs()
    .map((ref) => summarize(ref))
    .filter((s): s is NonNullable<ReturnType<typeof summarize>> => !!s)
    .sort((a, b) => (b.ceilingMax ?? 0) - (a.ceilingMax ?? 0));
  const spreads = rows.map((r) => r.spread).filter((v): v is number => v != null && v > 0);
  const maxSpread = spreads.length ? Math.max(...spreads) : null;

  // ⚠️ ハブは作るだけでなくTOPから繋ぐ。繋がないと孤立して評価が集まらない。
  const byFam = refsByFamily();
  const byBrand = refsByBrand();
  const famLinks = FAMILIES.filter((f) => (byFam[f.slug]?.length ?? 0) >= 2);
  const brandLinks = BRANDS.filter((b) => (byBrand[b.slug]?.length ?? 0) >= 2);

  // ファーストビューの数字は、ページ・sitemap と同じ publishableRefs() 由来の実データから数える（手で書かない）。
  const master = masterRefs();
  const shopMap = new Map<string, { id: string; name: string; refs: Set<string>; types: Set<string>; brands: Set<string> }>();
  for (const s of rows) {
    for (const r of s.records) {
      const e = shopMap.get(r.shop_id) ?? { id: r.shop_id, name: r.shop, refs: new Set(), types: new Set(), brands: new Set() };
      e.refs.add(s.ref);
      e.types.add(r.price_type);
      if (master[s.ref]?.brand) e.brands.add(master[s.ref].brand);
      shopMap.set(r.shop_id, e);
    }
  }
  const shops = [...shopMap.values()].sort((a, b) => b.refs.size - a.refs.size);
  // ブランドの並び: ハブのあるブランド → それ以外（一覧に無いブランドを先頭にしない）
  const brandOrder = [...BRANDS.map((b) => b.label), "パテック フィリップ", "カルティエ", "チューダー", "IWC", "パネライ", "ウブロ", "グランドセイコー"];
  const bi = (b: string) => (brandOrder.indexOf(b) < 0 ? 99 : brandOrder.indexOf(b));
  const searchItems = rows
    .map((r) => ({ ref: r.ref, model: r.models[0] ?? "" }))
    .sort((a, b) => a.ref.localeCompare(b.ref));
  const example = searchItems.find((x) => x.ref === "126610LN")?.ref ?? rows[0]?.ref ?? "";

  const ld = graph(
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: `${rows.length}型番の買取価格を買取店ごとに比較できるデータベース。${SITE_TAGLINE}。`,
      inLanguage: "ja",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    organization,
    // 画面に出ているハブのリンクと同じ並びにする
    itemList("ブランドから探す", brandLinks.map((b) => ({ name: b.label, path: `/brand/${b.slug}/` }))),
    itemList("モデルから探す", famLinks.map((f) => ({ name: f.label, path: `/model/${f.slug}/` }))),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main>
        {/* ---------- ファーストビュー ---------- */}
        <section className="hero on-navy" id="search" aria-labelledby="site-h1">
          <picture className="hero__photo">
            <source media="(max-width: 768px)" srcSet="/images/hero-watch-sm.webp" />
            <img src="/images/hero-watch.webp" alt="" width={2400} height={1340} fetchPriority="high" decoding="async" />
          </picture>
          <div className="hero__body">
            <h1 id="site-h1" className="hero__eyebrow">{SITE_NAME}</h1>
            <p className="hero__title"><span className="nobr">その時計の、</span><span className="nobr">いまの価値を。</span></p>
            <p className="hero__lead"><span className="nobr">型番ごとの買取価格を、</span><span className="nobr">主要買取店{shops.length}社で毎日比較。</span></p>
            <div className="hero__actions">
              <RefSearch items={searchItems} example={example} />
              <div className="hero__buttons">
                <a href="#brands" className="btn">ブランドから探す</a>
                <a href="#models" className="btn">モデルから探す</a>
              </div>
            </div>
          </div>
          <div className="stat-strip" aria-label="掲載状況">
            <div>掲載<b className="num">{rows.length}</b>型番</div>
            <div>比較<b className="num">{shops.length}</b>社</div>
            <div><b className="num">{brandLinks.length}</b>ブランド</div>
            <div>毎日更新</div>
          </div>
        </section>

        {/* ---------- ブランド ---------- */}
        <section className="section section--white" id="brands">
          <div className="wrap">
            <SectionHead en="Brands" title="ブランドから探す" icon={<IconBrand />} />
            <div className="link-grid link-grid--fit reveal">
              {brandLinks.map((b) => (
                <Link key={b.slug} href={`/brand/${b.slug}/`} className="link-card">
                  <span className="link-card__label">{b.label}</span>
                  <span className="link-card__meta">
                    <span className="num">{byBrand[b.slug]?.length ?? 0}型番</span>
                    <Arrow className="link-card__arrow" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- モデル ---------- */}
        <section className="section" id="models">
          <div className="wrap">
            <SectionHead en="Models" title="モデルから探す" icon={<IconWatch />} />
            <div className="link-grid reveal">
              {famLinks.map((f) => (
                <Link key={f.slug} href={`/model/${f.slug}/`} className="link-card">
                  <span className="link-card__label">{f.label}</span>
                  <span className="link-card__meta">
                    <span><span className="num">{byFam[f.slug]?.length ?? 0}型番</span>
                      <span className="ml-2 text-[11px] tracking-wide opacity-80">{f.brand}</span></span>
                    <Arrow className="link-card__arrow" />
                  </span>
                </Link>
              ))}
            </div>
            <p className="prose-jp reveal mt-10 max-w-3xl">
              当サイトでは、買取店が公開している腕時計の「型番別の買取価格」を毎日収集し、比較しています。
              価格は各社の公開ページを出典とし、取得日を併記して掲載しています。
            </p>
          </div>
        </section>

        {/* ---------- 掲載データの概要 ---------- */}
        <section className="section section--white">
          <div className="wrap">
            <SectionHead en="Overview" title="掲載データの概要" icon={<IconFigures />} />
            <div className="panel figures figures--3 reveal" style={{ ["--cols" as string]: 3 }}>
              <div>
                <p className="figures__value">{rows.length}</p>
                <p className="figures__label">掲載型番</p>
              </div>
              <div>
                <p className="figures__value">{maxSpread != null ? yen(maxSpread) : "—"}</p>
                <p className="figures__label">店舗間の差額（最大）</p>
              </div>
              <div>
                <p className="figures__value">{date}</p>
                <p className="figures__label">最終取得日</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- ランキング（抜粋） ---------- */}
        <section className="section" id="ranking">
          <div className="wrap">
            <SectionHead en="Ranking" title="店舗間の差額が大きい型番" icon={<IconTrend />} />
            <p className="prose-jp reveal mb-8 max-w-3xl">
              同じ型番でも、買取店により公開している上限額に差があります。{date}時点で差額が大きい上位5型番です。
            </p>
            <div className="table-frame reveal">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>型番</th>
                    <th className="hide-sm">モデル</th>
                    <th className="r">店舗間の差額</th>
                    <th className="r">上限額（最高）</th>
                  </tr>
                </thead>
                <tbody>
                  {topSpread(5).map((r) => (
                    <tr key={r.ref}>
                      <td className="whitespace-nowrap"><a href={`/ref/${r.ref.toLowerCase()}/`}>{r.ref}</a><span className="sub-sm">{r.model}</span></td>
                      <td className="hide-sm">{r.model || "—"}</td>
                      <td className="r strong">{yen(r.s.spread ?? 0)}</td>
                      <td className="r">{r.s.ceilingMax != null ? yen(r.s.ceilingMax) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
            <div className="reveal mt-8">
              <a href="/ranking/" className="btn">買取価格ランキングを見る<Arrow /></a>
            </div>
          </div>
        </section>

        {/* ---------- 比較している買取店 ---------- */}
        <section className="section" id="shops">
          <div className="wrap">
            <SectionHead en="Buyback shops" title="比較している買取店" icon={<IconShop />} />
            <p className="prose-jp reveal mb-10 max-w-3xl">
              当サイトでは、型番別の買取価格を自社サイトで公開している買取店{shops.length}社の情報を掲載しています。
              掲載型番数・ブランドは、{date}時点で当サイトに掲載している型番について集計したものです。
            </p>
            <div className="shop-grid">
              {shops.map((sh, i) => {
                const page = SHOP_PAGES[sh.id];
                const brands = [...sh.brands].sort((a, b) => bi(a) - bi(b));
                return (
                  <article key={sh.id} className="shop-card reveal" style={{ ["--d" as string]: `${(i % 3) * 0.08}s` }}>
                    {page?.image && (
                      <figure>
                        <img src={page.image} alt={`${sh.name}の公式サイト（買取価格のページ）`} width={1280} height={800} loading="lazy" decoding="async" />
                        <figcaption>出典：{sh.name} 公式サイト（{CAPTURED_ON}時点）</figcaption>
                      </figure>
                    )}
                    <div className="shop-card__body">
                      <h3 className="shop-card__name"><a href={`/shop/${sh.id}/`}>{sh.name}</a></h3>
                      <dl>
                        <dt>掲載型番</dt>
                        <dd className="num">{sh.refs.size}型番</dd>
                        <dt>ブランド</dt>
                        <dd>{brands.join("・")}</dd>
                        <dt>価格の区分</dt>
                        <dd>{[...sh.types].join("・")}</dd>
                      </dl>
                      <div className="shop-card__links">
                        <a href={`/shop/${sh.id}/`} className="btn btn-sm">
                          掲載データを見る<Arrow />
                        </a>
                        {page && (
                          <a href={page.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                            公式サイトを見る<Arrow />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- 型番別の買取価格 ---------- */}
        <section className="section section--white" id="refs">
          <div className="wrap">
            <SectionHead en="Price list" title="型番別の買取価格" icon={<IconTable />} />
            <div className="table-frame reveal">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>型番</th>
                    <th>モデル</th>
                    <th className="r">上限額（最高）</th>
                    <th className="r">店舗間の差額</th>
                    <th className="r">比較社数</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.ref}>
                      <td className="whitespace-nowrap">
                        <a href={`/ref/${s.ref.toLowerCase()}/`}>{s.ref}</a>
                      </td>
                      <td>{s.models[0] ?? "—"}</td>
                      <td className="r strong">{s.ceilingMax != null ? yen(s.ceilingMax) : "—"}</td>
                      <td className="r">{s.spread != null ? yen(s.spread) : "—"}</td>
                      <td className="r">{s.shops.length}社</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-scroll-hint">表は横にスクロールしてご覧いただけます。</p>
            <p className="note mt-4">
              ※各社が公開している買取価格を{date}に取得したものです。実際の査定額は、個体の状態・付属品・時期により変動します。
            </p>
          </div>
        </section>

        {/* ---------- 掲載ポリシー ---------- */}
        <section className="section section--navy" id="policy">
          <div className="wrap">
            <SectionHead en="Policy" title="データの取得方法と掲載方針" icon={<IconDocument />} />
            <div className="reveal grid gap-10 md:grid-cols-[1fr_auto]">
              <p className="prose-jp max-w-3xl">
                データの取得方法：当サイトでは、各買取店が自社サイトで公開している型番別の買取価格ページを定期的に取得し、型番・日付・買取店・価格の組み合わせで記録しています。
                価格の推定や補完は行わず、公開されていない項目は掲載しておりません。出典は、各型番ページ内にリンクで明記しています。
                また、同じ型番・同じ状態区分で他社の価格から極端に離れている価格（他社の中央値の4倍超または4分の1未満。桁の誤記と考えられるもの）は、各社への確認ができないため掲載・集計の対象から外しています。
              </p>
              <div className="flex items-start">
                <a href="#search" className="btn">
                  <IconSearch size={20} />型番から探す
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
