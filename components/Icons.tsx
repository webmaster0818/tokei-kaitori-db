// 単色の線画アイコン（ロゴと同じ線の考え方）。色は currentColor、絵文字や多色アイコンは使わない。
type P = { className?: string; size?: number };
function Svg({ className, size = 64, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={1.25}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

/** ブランド: 化粧箱と時計 */
export const IconBrand = (p: P) => (
  <Svg {...p}>
    <path d="M10 26h44v28H10z" />
    <path d="M6 18h52v8H6z" />
    <path d="M32 18v36" />
    <circle cx="32" cy="38" r="9" fill="var(--icon-bg, transparent)" />
    <circle cx="32" cy="38" r="6" />
    <path d="M32 38v-3.5M32 38l2.5 1.5" />
    <path d="M22 18c-4-5 1-10 6-6l4 6 4-6c5-4 10 1 6 6" />
  </Svg>
);

/** モデル: 腕時計の正面 */
export const IconWatch = (p: P) => (
  <Svg {...p}>
    <path d="M24 14l2-9h12l2 9M24 50l2 9h12l2-9" />
    <circle cx="32" cy="32" r="18" />
    <circle cx="32" cy="32" r="14" />
    <path d="M50 29h3v6h-3" />
    <path d="M32 32V22M32 32l7 4" />
    <path d="M32 19.5v1.5M32 43v1.5M19.5 32H21M43 32h1.5" />
  </Svg>
);

/** 検索: ルーペ */
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="27" cy="27" r="17" />
    <circle cx="27" cy="27" r="12" />
    <path d="M39.5 39.5L56 56" />
    <path d="M42 45l3-3" />
  </Svg>
);

/** 買取店: 店構え */
export const IconShop = (p: P) => (
  <Svg {...p}>
    <path d="M8 24l4-14h40l4 14" />
    <path d="M8 24h48v3a6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0z" />
    <path d="M12 32v24h40V32" />
    <path d="M18 56V40h12v16" />
    <path d="M36 40h10v8H36z" />
  </Svg>
);

/** 価格表: 表 */
export const IconTable = (p: P) => (
  <Svg {...p}>
    <path d="M8 12h48v40H8z" />
    <path d="M8 22h48M8 32h48M8 42h48M26 12v40M42 12v40" />
  </Svg>
);

/** 数値の概要: 上昇する棒（ロゴの棒と同じ考え方） */
export const IconFigures = (p: P) => (
  <Svg {...p}>
    <path d="M8 56h48" />
    <path d="M13 56V42h7v14M25 56V34h7v22M37 56V26h7v30M49 56V14h7" />
    <path d="M56 14v42" />
  </Svg>
);

/** 推移: 折れ線 */
export const IconTrend = (p: P) => (
  <Svg {...p}>
    <path d="M8 8v48h48" />
    <path d="M14 44l10-12 9 7 11-15 10 6" />
    <circle cx="24" cy="32" r="1.6" />
    <circle cx="33" cy="39" r="1.6" />
    <circle cx="44" cy="24" r="1.6" />
  </Svg>
);

/** 掲載方針: 文書 */
export const IconDocument = (p: P) => (
  <Svg {...p}>
    <path d="M14 6h26l10 10v42H14z" />
    <path d="M40 6v10h10" />
    <path d="M21 26h22M21 33h22M21 40h22M21 47h13" />
  </Svg>
);

/** 関連: つながり */
export const IconLink = (p: P) => (
  <Svg {...p}>
    <circle cx="16" cy="32" r="7" />
    <circle cx="48" cy="16" r="7" />
    <circle cx="48" cy="48" r="7" />
    <path d="M22.5 29l19-10M22.5 35l19 10" />
  </Svg>
);

export const Arrow = ({ className }: { className?: string }) => (
  <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" className={className}>
    <path d="M0 5h17M13 1l4 4-4 4" />
  </svg>
);
