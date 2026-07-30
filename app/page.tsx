import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { latestDate, prototypeRefs, summarize, yen } from "@/lib/prices";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "腕時計の型番ごとの買取価格を、買取店が公開している価格から毎日収集して比較。同じ型番で店によっていくら差があるかを、出典リンクと取得日つきで確認できます。",
  alternates: { canonical: `${SITE_URL}/` },
};

export default function Home() {
  const date = latestDate();
  const rows = prototypeRefs()
    .map((ref) => summarize(ref))
    .filter((s): s is NonNullable<ReturnType<typeof summarize>> => !!s)
    .sort((a, b) => (b.ceilingMax ?? 0) - (a.ceilingMax ?? 0));
  const spreads = rows.map((r) => r.spread).filter((v): v is number => v != null && v > 0);
  const maxSpread = spreads.length ? Math.max(...spreads) : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">{SITE_NAME}</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        腕時計の買取価格を、買取店が公開している「型番別の買取価格」から毎日収集して比較しています。
        価格は各社の公開ページを出典として、取得日つきで掲載します。
      </p>

      <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">現在のデータ</p>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-semibold text-neutral-900">{rows.length}</p>
            <p className="mt-1 text-xs text-neutral-500">掲載型番</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-neutral-900">{maxSpread != null ? yen(maxSpread) : "—"}</p>
            <p className="mt-1 text-xs text-neutral-500">店による差の最大</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-neutral-900">{date}</p>
            <p className="mt-1 text-xs text-neutral-500">最終取得日</p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-neutral-900">型番別の買取価格</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3">型番</th>
                <th className="px-4 py-3">モデル</th>
                <th className="px-4 py-3 text-right">上限の最高</th>
                <th className="px-4 py-3 text-right">店による差</th>
                <th className="px-4 py-3 text-right">比較店舗</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.ref} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/ref/${s.ref.toLowerCase()}/`} className="font-medium text-neutral-900 underline decoration-neutral-300 hover:decoration-neutral-800">
                      {s.ref}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{s.models[0] ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-900">{s.ceilingMax != null ? yen(s.ceilingMax) : "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{s.spread != null ? yen(s.spread) : "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-500">{s.shops.length}社</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          ※各社が公開している買取価格を{date}に取得したものです。実際の査定額は個体の状態・付属品・時期により変動します。
        </p>
      </section>

      <section className="mt-10 border-t border-neutral-200 pt-8 text-xs leading-relaxed text-neutral-500">
        <p>
          データの取得方法: 各買取店が自社サイトで公開している型番別の買取価格ページを定期取得し、型番・日付・店舗・価格の組で記録しています。
          価格の推定や補完は行わず、公開されていない項目は掲載しません。出典は各型番ページ内にリンクで明記しています。
        </p>
      </section>
    </main>
  );
}
