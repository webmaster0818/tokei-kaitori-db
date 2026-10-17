"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// スクロールで .reveal 要素を表示する。
// ⚠️ 非表示にするのは <html class="js"> のときだけ（layout の head で付与）。JS が動かない環境では最初から見える。
// ⚠️ prefers-reduced-motion: reduce の場合は CSS 側で非表示自体を行わない。
export function Reveal() {
  // ⚠️ クライアント遷移（next/link）でもページが入れ替わるので、パスが変わるたびに付け直す。
  const pathname = usePathname();
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
