import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { latestDate, monthlyHistory, prototypeRefs, summarize, yen } from "@/lib/prices";

export function generateStaticParams() {
  return prototypeRefs().map((ref) => ({ ref: ref.toLowerCase() }));
}

function resolve(param: string) {
  return prototypeRefs().find((r) => r.toLowerCase() === param.toLowerCase());
}

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref: p } = await params;
  const ref = resolve(p);
  if (!ref) return { title: "型番が見つかりません" };
  const s = summarize(ref);
  const model = s?.models[0] ?? "";
  const head = s?.ceilingMax ? `買取上限${yen(s.ceilingMax)}` : "買取価格";
  return {
    title: `${ref} ${model}の買取価格【${latestDate()}時点】${head}・${s?.shops.length ?? 0}社比較 | ${SITE_NAME}`,
    description: `${model} Ref.${ref}の買取価格を${s?.shops.length ?? 0}社の公開情報から比較。${s?.ceilingMin && s?.ceilingMax ? `上限提示は${yen(s.ceilingMin)}〜${yen(s.ceilingMax)}で、店による差は${yen(s.spread ?? 0)}。` : ""}各社の出典リンクと取得日を明記しています。`,
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
  const others = prototypeRefs().filter((r) => r !== ref).slice(0, 6);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${s.models[0] ?? ""} Ref.${ref} の買取価格比較データ`,
    description: `買取店${s.shops.length}社が公開している Ref.${ref} の買取価格を収集・比較したデータ（${date}時点）。`,
    creator: { "@type": "Organization", name: SITE_NAME },
    dateModified: date,
    variableMeasured: [
      s.ceilingMax != null ? { "@type": "PropertyValue", name: "買取上限の最高提示額", value: s.ceilingMax, unitText: "JPY" } : null,
      s.ceilingMin != null ? { "@type": "PropertyValue", name: "買取上限の最低提示額", value: s.ceilingMin, unitText: "JPY" } : null,
      s.spread != null ? { "@type": "PropertyValue", name: "店舗間の提示差", value: s.spread, unitText: "JPY" } : null,
    ].filter(Boolean),
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <nav className="mb-6 text-xs text-neutral-500">
        <Link href="/" className="hover:underline">ホーム</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-800">Ref.{ref}</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
        {s.models[0] ?? "腕時計"} Ref.{ref} の買取価格
      </h1>
      <p className="mt-2 text-sm text-neutral-500">{date}時点 / 買取店{s.shops.length}社の公開情報を比較</p>

      {/* 結論ボックス */}
      <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">まず結論</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center md:grid-cols-4">
          <div>
            <p className="text-xl font-semibold text-neutral-900">{s.ceilingMax != null ? yen(s.ceilingMax) : "—"}</p>
            <p className="mt-1 text-xs text-neutral-500">最高の上限提示</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-neutral-900">{s.ceilingMin != null ? yen(s.ceilingMin) : "—"}</p>
            <p className="mt-1 text-xs text-neutral-500">最低の上限提示</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-neutral-900">{s.spread != null ? yen(s.spread) : "—"}</p>
            <p className="mt-1 text-xs text-neutral-500">店による差</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-neutral-900">{s.shops.length}社</p>
            <p className="mt-1 text-xs text-neutral-500">比較した店舗数</p>
          </div>
        </div>
        {s.topShop && (
          <p className="mt-4 text-sm leading-relaxed text-neutral-700">
            {date}時点で最も高い上限額を公開しているのは<strong>{s.topShop.shop}</strong>の{yen(s.topShop.price)}
            {s.topShop.condition ? `（${s.topShop.condition}）` : ""}です。
            {s.spread != null && s.spread > 0 && <>同じ型番でも店によって最大{yen(s.spread)}の差があります。</>}
          </p>
        )}
      </section>

      {/* 各社比較表 */}
      <section className="mt-10">
        <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-900">各社の買取価格（{date}時点）</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3">買取店</th>
                <th className="px-4 py-3">区分</th>
                <th className="px-4 py-3">状態・仕様</th>
                <th className="px-4 py-3 text-right">価格</th>
                <th className="px-4 py-3">出典</th>
              </tr>
            </thead>
            <tbody>
              {s.records.map((r, i) => (
                <tr key={i} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-neutral-800">{r.shop}</td>
                  <td className="px-4 py-3 text-neutral-500">{r.price_type}</td>
                  <td className="px-4 py-3 text-neutral-500">{[r.condition, r.dial, r.material].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-900">{yen(r.price_jpy)}</td>
                  <td className="px-4 py-3">
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 underline decoration-neutral-300 hover:text-neutral-800">
                      公開ページ
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          ※各社が公開している買取価格を{date}に取得して掲載しています。「上限」は状態が良い場合の最大額、「相場」は各社が相場として公開している値です。実際の査定額は個体の状態・付属品・時期により変動します。最新価格は各社の公開ページでご確認ください。
        </p>
      </section>

      {/* 月次推移(データがある場合のみ) */}
      {history.length >= 2 && (
        <section className="mt-10">
          <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-900">買取相場の推移（月次）</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3">年月</th>
                  <th className="px-4 py-3 text-right">相場</th>
                  <th className="px-4 py-3 text-right">前月比</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(-12).map((h, i, arr) => {
                  const prev = i > 0 ? arr[i - 1].price : null;
                  const diff = prev != null ? h.price - prev : null;
                  return (
                    <tr key={h.month} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3 text-neutral-800">{h.month}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{yen(h.price)}</td>
                      <td className={`px-4 py-3 text-right ${diff == null ? "text-neutral-400" : diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-700" : "text-neutral-500"}`}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toLocaleString("ja-JP")}円`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            ※月次の相場推移は
            <a href={history[0].source_url} target="_blank" rel="noopener noreferrer" className="underline decoration-neutral-300">出典元</a>
            が公開している履歴データに基づきます。
          </p>
        </section>
      )}

      {/* 高く売るための実務ポイント(データから導ける事実のみ) */}
      <section className="mt-10">
        <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-900">このデータの読み方</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-neutral-700">
          <li>・掲載額は各社が公開している「買取価格」です。実際の査定は個体差（傷・付属品・保証書の有無）で上下します。</li>
          {s.spread != null && s.spread > 0 && (
            <li>・同じ型番でも公開額に{yen(s.spread)}の差があるため、1社だけの査定で決めないことが実質的な差になります。</li>
          )}
          <li>・文字盤色や素材で価格が分かれる型番があります。上の表で仕様が明記されている行は、その条件での価格です。</li>
          <li>・価格は毎日更新される店舗もあるため、当ページも日次で取得し直しています（最終取得: {date}）。</li>
        </ul>
      </section>

      {others.length > 0 && (
        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="text-sm font-semibold text-neutral-900">他の型番の買取価格</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((r) => (
              <Link key={r} href={`/ref/${r.toLowerCase()}/`} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-500">
                Ref.{r}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
