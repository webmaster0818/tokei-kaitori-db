import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, masterRefs, summarize, yen } from "@/lib/prices";
import { FAMILIES, MIN_REFS, refsByFamily } from "@/lib/models";

/*
  モデル別ハブ（/model/daytona/ など）。
  ⚠️ 作った理由: GSC実測（2026-09-21）で流入が型番クエリだけだった。
     「デイトナ 買取相場」のようなモデル名クエリの受け皿がゼロだったため。
  ⚠️ 数値は全て summarize() の実データ。型番ページと同じ値しか出さない。
  ⚠️ 型番が1件しか無い家族はページを作らない（比較にならないページを増やさない）。
*/

function families() {
  const byFam = refsByFamily();
  return FAMILIES.filter((f) => (byFam[f.slug]?.length ?? 0) >= MIN_REFS);
}

export function generateStaticParams() {
  return families().map((f) => ({ slug: f.slug }));
}

type Row = { ref: string; model: string; max: number | null; min: number | null; spread: number | null; shops: number };

function rows(slug: string): Row[] {
  const master = masterRefs();
  const refs = refsByFamily()[slug] ?? [];
  return refs
    .map((ref) => {
      const s = summarize(ref);
      return {
        ref,
        model: s?.models[0] ?? master[ref]?.models?.[0] ?? "",
        max: s?.ceilingMax ?? null,
        min: s?.ceilingMin ?? null,
        spread: s?.spread ?? null,
        shops: s?.shops.length ?? 0,
      };
    })
    .sort((a, b) => (b.max ?? 0) - (a.max ?? 0));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = families().find((x) => x.slug === slug);
  if (!f) return { title: "見つかりません" };
  const r = rows(slug);
  const top = r[0];
  const widest = r.reduce<Row | null>((a, b) => (!a || (b.spread ?? 0) > (a.spread ?? 0) ? b : a), null);
  const d = latestDate();
  return {
    title: `${f.brand} ${f.label}の買取相場｜${r.length}型番を買取店で比較【${d.slice(0, 7).replace("-", "年")}月】`,
    description:
      `${f.brand} ${f.label}の買取価格を型番ごとに比較。${d}時点で上限が最も高いのは${top?.ref ?? ""}の${top?.max ? yen(top.max) : "—"}。` +
      (widest?.spread ? `同じ型番でも店により最大${yen(widest.spread)}の差があります。` : "") +
      `各社の公開情報を出典つきで掲載しています。`,
    alternates: { canonical: `${SITE_URL}/model/${slug}/` },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = families().find((x) => x.slug === slug);
  if (!f) notFound();
  const r = rows(slug);
  const date = latestDate();
  const top = r[0];
  const widest = r.reduce<Row | null>((a, b) => (!a || (b.spread ?? 0) > (a.spread ?? 0) ? b : a), null);
  const others = families().filter((x) => x.slug !== slug);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${f.brand} ${f.label} の買取価格比較データ`,
    description: `${f.brand} ${f.label}の${r.length}型番について、買取店が公開している買取価格を収集・比較したデータ（${date}時点）。`,
    creator: { "@type": "Organization", name: SITE_NAME },
    dateModified: date,
    url: `${SITE_URL}/model/${slug}/`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <nav className="text-xs text-neutral-500">
          <Link href="/" className="hover:underline">ホーム</Link>
          <span> / </span>
          <span>{f.label}</span>
        </nav>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          {f.brand} {f.label}の買取相場
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {date} 時点 / {r.length}型番を比較
        </p>

        {/* 結論を先に出す。数値はすべて型番ページと同じ実データ */}
        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
          <p className="text-sm font-semibold text-neutral-900">まず結論</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-700">
            {top?.max && (
              <li>
                上限が最も高いのは <a className="underline" href={`/ref/${top.ref.toLowerCase()}/`}>{top.ref}</a>
                （{top.model}）の <strong>{yen(top.max)}</strong> です。
              </li>
            )}
            {widest?.spread ? (
              <li>
                同じ型番でも店によって差が出ます。差が最も大きいのは{" "}
                <a className="underline" href={`/ref/${widest.ref.toLowerCase()}/`}>{widest.ref}</a> で、
                <strong>{yen(widest.spread)}</strong> の開きがあります。
              </li>
            ) : null}
            <li>1社だけで決めると、この差がそのまま損になります。</li>
          </ul>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-neutral-900">型番ごとの買取価格（{date} 時点）</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-900 text-white">
                <th className="px-3 py-2 text-left">型番</th>
                <th className="px-3 py-2 text-left">モデル</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">上限（最高）</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">店による差</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">比較社数</th>
              </tr>
            </thead>
            <tbody>
              {r.map((x, i) => (
                <tr key={x.ref} className={i % 2 ? "bg-neutral-50" : "bg-white"}>
                  <td className="border-t border-neutral-200 px-3 py-2 font-medium">
                    <a className="underline" href={`/ref/${x.ref.toLowerCase()}/`}>{x.ref}</a>
                  </td>
                  <td className="border-t border-neutral-200 px-3 py-2 text-neutral-600">{x.model}</td>
                  <td className="border-t border-neutral-200 px-3 py-2 text-right whitespace-nowrap">
                    {x.max ? yen(x.max) : "—"}
                  </td>
                  <td className="border-t border-neutral-200 px-3 py-2 text-right whitespace-nowrap">
                    {x.spread ? yen(x.spread) : "—"}
                  </td>
                  <td className="border-t border-neutral-200 px-3 py-2 text-right">{x.shops}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          ※ 各社が公開している買取価格を {date} に取得して掲載しています。「店による差」は、
          その型番で最も高い提示額と最も低い提示額の差です。実際の査定額は個体の状態・付属品・時期により変動します。
        </p>

        <h2 className="mt-10 text-lg font-semibold text-neutral-900">他のモデル</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/model/${o.slug}/`}
              className="rounded border border-neutral-200 px-3 py-1.5 text-sm hover:border-neutral-400"
            >
              {o.label}
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
