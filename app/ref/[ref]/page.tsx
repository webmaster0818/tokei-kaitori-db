import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, masterRefs, monthlyHistory, publishableRefs, summarize, yen } from "@/lib/prices";
import { publishedBrandOf, publishedFamilyOf } from "@/lib/models";
import { breadcrumb, graph, organization } from "@/lib/jsonld";
import { IconDocument, IconFigures, IconLink, IconTable, IconTrend } from "@/components/Icons";

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
  const model = s?.models[0] ?? "";
  // ⚠️ 以前は型番が先頭だったため、型番を知らない人には何のページか分からなかった
  //    （GSC実測 2026-09-21: 流入が型番クエリだけ・CTR 0.72%）。
  //    モデル名を先頭に出し、うちにしか出せない「店による差額」を見出しに使う。
  const ym = `${latestDate().slice(0, 4)}年${Number(latestDate().slice(5, 7))}月`;
  const gap = s?.spread ? `${s.shops.length}社で最大${yen(s.spread)}の差` : `${s?.shops.length ?? 0}社比較`;
  return {
    title: `${model} ${ref}の買取相場｜${gap}【${ym}】| ${SITE_NAME}`,
    description: `${model} Ref.${ref}の買取価格を、${s?.shops.length ?? 0}社の公開情報から比較しています。${s?.ceilingMin && s?.ceilingMax ? `上限額は${yen(s.ceilingMin)}〜${yen(s.ceilingMax)}で、店舗間の差額は${yen(s.spread ?? 0)}です。` : ""}各社の出典リンクと取得日を明記しています。`,
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
  const fam = publishedFamilyOf(master[ref]?.models ?? []);
  const brand = publishedBrandOf(master[ref]?.brand);
  // ⚠️ 先頭6件を固定で出していたため、その6ページにしかリンクが集まらず、
  //    73型番がTOPからの1本だけで孤立していた（2026-09-29に判明）。
  //    並びの中で自分の前後を出して、鎖状に全型番が繋がるようにする。
  const all = publishableRefs();
  const idx = all.indexOf(ref);
  const others = all.slice(Math.max(0, idx - 3), idx + 4).filter((r) => r !== ref);

  const ld = graph(
    {
      "@type": "Dataset",
      name: `${s.models[0] ?? ""} Ref.${ref} の買取価格比較データ`,
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
            {s.models[0] ?? "腕時計"} Ref.{ref} の買取価格
          </h1>
          <p className="page-meta">{date}時点 / 買取店{s.shops.length}社の公開情報を比較</p>
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
              {s.topShop.condition ? `（${s.topShop.condition}）` : ""}です。
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
                <th>取得日</th>
                <th>出典</th>
              </tr>
            </thead>
            <tbody>
              {s.records.map((r, i) => (
                <tr key={i}>
                  <td className="strong whitespace-nowrap">{r.shop}</td>
                  <td className="whitespace-nowrap">{r.price_type}</td>
                  {/* 同じ型番でもブレス違い等でモデル名が分かれることがある（例: 126300 の
                      オイスターブレス/ジュビリーブレス）。モデルが複数ある型番では名前を出さないと
                      「同じ状態・同じ文字盤なのに価格が違う行」に見えてしまうため、そのときだけ併記する。 */}
                  <td>
                    {[s.models.length > 1 ? r.model : null, r.condition, r.dial, r.material].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="r strong">{yen(r.price_jpy)}</td>
                  {/* ⚠️ 店ごとに取得日を出す。取得元のサイトが落ちた日は直近の値を引き継ぐため、
                      全部を「今日時点」と書くと嘘になる（2026-10-02のウォッチニアン停止で発生）。 */}
                  <td className="whitespace-nowrap text-xs">
                    {!r.fetched_at ? "—"
                      : r.fetched_at === date ? r.fetched_at
                      : <strong className="text-[var(--ink)]">{r.fetched_at}</strong>}
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
        </p>
      </section>

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
