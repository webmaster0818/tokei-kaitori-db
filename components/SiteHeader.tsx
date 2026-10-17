import Link from "next/link";
import { LogoMark } from "./Logo";
import { SITE_NAME } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="site-brand" aria-label={`${SITE_NAME} ホーム`}>
          <LogoMark size={36} strokeWidth={1.5} />
          <span>
            <span className="site-brand__name">{SITE_NAME}</span>
            <span className="site-brand__sub">BRAND WATCH BANK</span>
          </span>
        </Link>
        <nav className="site-nav" aria-label="サイト内メニュー">
          <a href="/#brands">ブランド</a>
          <a href="/#models">モデル</a>
          <a href="/ranking/">ランキング</a>
          <a href="/#shops">買取店</a>
          <a href="/guide/">売却ガイド</a>
          <a href="/faq/">よくある質問</a>
          <a href="/#search">型番検索</a>
        </nav>
      </div>
    </header>
  );
}
