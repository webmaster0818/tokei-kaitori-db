import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // OGPは1枚を全ページ共通で使う。型番ごとに画像を作ると、買取価格を画像に焼くことになり
  // 日々変わる数字が古いまま配られる。
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ja_JP",
    url: `${SITE_URL}/`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  title: SITE_NAME,
  description: "腕時計の型番別買取価格を複数の買取店の公開情報から毎日比較するデータベース。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
