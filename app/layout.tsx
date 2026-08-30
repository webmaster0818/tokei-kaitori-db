import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: "腕時計の型番別買取価格を複数の買取店の公開情報から毎日比較するデータベース。",
  // ⚠️【ドメイン確定までの暫定】SITE_URLが example.invalid のままなので、
  //    この状態でインデックスされると誤ったcanonicalをGoogleに教えることになる。
  //    ドメインを NEXT_PUBLIC_SITE_URL に設定したら、この robots ブロックを削除する。
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
