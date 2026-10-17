// ロゴ（案A「文字盤＋上昇する棒グラフ」）。単色の線画で、色は currentColor に従う（紺地・白地の両方で使う）。
// ⚠️ 形を変えるときは app/icon.svg と public/og-image.png も同じ形に作り直す。
export const LOGO_PATHS = {
  // 時刻＝10時10分。外周の上側に、左から右へ高くなる7本の棒
  bars: "M12 19V15M16 15.3V11.5M20 13.5V9M24 13V7.5M28 13.5V5.5M32 15.3V4M36 19V2.5",
  ticks: "M37 35.5L34 33.75M31.5 41L30 38.4M24 43V40M16.5 41L18 38.4M11 35.5L14 33.75",
  hands: "M24 28L19 23.5M24 28L30.5 21.5",
};

export function LogoMark({ size = 32, strokeWidth = 1.6, className }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="4 1 40 46"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="24" cy="28" r="15" />
      <circle cx="24" cy="28" r="11" />
      <path d={LOGO_PATHS.bars} />
      <path d={LOGO_PATHS.ticks} />
      <path d={LOGO_PATHS.hands} />
      <circle cx="24" cy="28" r="1.2" />
    </svg>
  );
}
