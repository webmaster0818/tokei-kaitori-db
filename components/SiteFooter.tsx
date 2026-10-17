import Link from "next/link";
import { LogoMark } from "./Logo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { publishedBrands, publishedFamilies } from "@/lib/models";
import { shopStats } from "@/lib/insights";

// フッターのリンクは、実在するハブ（ブランド・モデル）だけに張る（存在しないページへのリンクを作らない）。
export function SiteFooter() {
  const brands = publishedBrands();
  const fams = publishedFamilies();
  const shops = shopStats();
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__grid">
        <div>
          <Link href="/" className="site-brand" style={{ padding: 0 }}>
            <LogoMark size={40} strokeWidth={1.4} />
            <span className="site-brand__name">{SITE_NAME}</span>
          </Link>
          <p className="mt-5 text-[13px] leading-[1.9] tracking-wider text-[#c9ccd1]">
            {SITE_TAGLINE}。
            <br />
            当サイトでは、各買取店が公開している価格を出典・取得日とあわせて掲載しています。
          </p>
          <ul className="mt-5 !flex flex-wrap !gap-x-5 !gap-y-2">
            <li><a href="/ranking/">買取価格ランキング</a></li>
            {shops.map((s) => (
              <li key={s.id}><a href={`/shop/${s.id}/`}>{s.name}</a></li>
            ))}
            <li><a href="/guide/">売却ガイド</a></li>
            <li><a href="/faq/">よくある質問</a></li>
            <li><a href="/glossary/">時計の用語集</a></li>
            <li><a href="/#policy">掲載ポリシー</a></li>
          </ul>
        </div>
        <div>
          <h3>BRANDS</h3>
          <ul>
            {brands.map((b) => (
              <li key={b.slug}><Link href={`/brand/${b.slug}/`}>{b.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>MODELS</h3>
          <ul className="!grid-cols-1 sm:!grid-cols-2 !gap-x-5">
            {fams.map((f) => (
              <li key={f.slug}><Link href={`/model/${f.slug}/`}>{f.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="wrap">
        <div className="site-footer__bottom">&copy; {SITE_NAME}（brandwatchbank.com）</div>
      </div>
    </footer>
  );
}
