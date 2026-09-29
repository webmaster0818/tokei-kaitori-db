import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, masterRefs, summarize, yen } from "@/lib/prices";
import { BRANDS, FAMILIES, familyOf, refsByBrand, refsByFamily } from "@/lib/models";

/*
  ブランド別ハブ（/brand/rolex/ など）。モデルハブへの入口。
  ⚠️ 数値は summarize() の実データのみ。ブランド単位の平均などは出さない
     （型番ごとに状態も年式も違うので、平均に意味が無い）。
*/

function brands() {
  const byBrand = refsByBrand();
  return BRANDS.filter((b) => (byBrand[b.slug]?.length ?? 0) >= 2);
}

export function generateStaticParams() {
  return brands().map((b) => ({ slug: b.slug }));
}

function familiesOfBrand(slug: string) {
  const label = BRANDS.find((b) => b.slug === slug)?.label;
  const byFam = refsByFamily();
  return FAMILIES.filter((f) => f.brand === label && (byFam[f.slug]?.length ?? 0) >= 2).map((f) => ({
    ...f,
    refs: byFam[f.slug] ?? [],
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = brands().find((x) => x.slug === slug);
  if (!b) return { title: "見つかりません" };
  const refs = refsByBrand()[slug] ?? [];
  const d = latestDate();
  return {
    title: `${b.label}の買取相場｜${refs.length}型番を買取店で比較【${d.slice(0, 7).replace("-", "年")}月】`,
    description: `${b.label}の買取価格を型番ごとに比較。${d}時点の公開情報を各社の出典つきで掲載しています。モデル別に相場と店舗間の差額を確認できます。`,
    alternates: { canonical: `${SITE_URL}/brand/${slug}/` },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = brands().find((x) => x.slug === slug);
  if (!b) notFound();
  const fams = familiesOfBrand(slug);
  const refs = refsByBrand()[slug] ?? [];
  const date = latestDate();

  // モデルごとに「最高の上限」と「最大の差」を出す（型番ページと同じ実データ）
  const summary = fams.map((f) => {
    const rows = f.refs.map((ref) => summarize(ref)).filter((s): s is NonNullable<typeof s> => !!s);
    const max = rows.reduce((a, s) => Math.max(a, s.ceilingMax ?? 0), 0);
    const spread = rows.reduce((a, s) => Math.max(a, s.spread ?? 0), 0);
    return { ...f, count: rows.length, max, spread };
  });

  const ld = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${b.label} の買取価格比較データ`,
    description: `${b.label}の${refs.length}型番について、買取店が公開している買取価格を収集・比較したデータ（${date}時点）。`,
    creator: { "@type": "Organization", name: SITE_NAME },
    dateModified: date,
    url: `${SITE_URL}/brand/${slug}/`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <main className="mx-auto max-w-3xl px-5 py-10">
      <nav className="text-xs text-neutral-500">
        <Link href="/" className="hover:underline">ホーム</Link>
        <span> / </span>
        <span>{b.label}</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
        {b.label}の買取相場
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        {date} 時点 / {refs.length}型番 / モデル {summary.length}種
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">モデル別</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-900 text-white">
              <th className="px-3 py-2 text-left">モデル</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">型番数</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">上限の最高</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">店による差（最大）</th>
            </tr>
          </thead>
          <tbody>
            {summary
              .slice()
              .sort((x, y) => y.max - x.max)
              .map((f, i) => (
                <tr key={f.slug} className={i % 2 ? "bg-neutral-50" : "bg-white"}>
                  <td className="border-t border-neutral-200 px-3 py-2 font-medium">
                    <Link className="underline" href={`/model/${f.slug}/`}>{f.label}</Link>
                  </td>
                  <td className="border-t border-neutral-200 px-3 py-2 text-right">{f.count}</td>
                  <td className="border-t border-neutral-200 px-3 py-2 text-right whitespace-nowrap">
                    {f.max ? yen(f.max) : "—"}
                  </td>
                  <td className="border-t border-neutral-200 px-3 py-2 text-right whitespace-nowrap">
                    {f.spread ? yen(f.spread) : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-neutral-500">
        ※ 各社が公開している買取価格を {date} に取得して掲載しています。ブランド全体の平均額は出していません。
        型番ごとに年式も仕様も違い、平均に意味が無いためです。
      </p>

      <h2 className="mt-10 text-lg font-semibold text-neutral-900">他のブランド</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {brands()
          .filter((x) => x.slug !== slug)
          .map((x) => (
            <Link key={x.slug} href={`/brand/${x.slug}/`} className="rounded border border-neutral-200 px-3 py-1.5 text-sm hover:border-neutral-400">
              {x.label}
            </Link>
          ))}
      </div>
    </main>
    </>
  );
}
