import type { CSSProperties } from "react";

/**
 * The NimCuet mark: an engraved "N" in a warm-ink tile with a champagne edge.
 * Pure SVG so it stays razor sharp at every density (no raster assets).
 */
export function LogoMark({
  size = 40,
  className = "",
  style,
  glow = false,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
  glow?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="NimCuet"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="nc-gold" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbe3b0" />
          <stop offset="0.46" stopColor="#f4a261" />
          <stop offset="1" stopColor="#c14f24" />
        </linearGradient>
        <linearGradient id="nc-tile" x1="6" y1="2" x2="58" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2a1c34" />
          <stop offset="0.55" stopColor="#171021" />
          <stop offset="1" stopColor="#0b0810" />
        </linearGradient>
        <radialGradient id="nc-sheen" cx="0" cy="0" r="1" gradientTransform="translate(20 14) rotate(48) scale(44)">
          <stop stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="nc-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="1.5" y="1.5" width="61" height="61" rx="19" fill="url(#nc-tile)" />
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="19"
        stroke="url(#nc-gold)"
        strokeOpacity="0.55"
        strokeWidth="1.1"
      />
      <rect x="1.5" y="1.5" width="61" height="61" rx="19" fill="url(#nc-sheen)" />

      <path
        d="M19.5 45.5V19.5L44.5 44.5V19.5"
        stroke="url(#nc-gold)"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={glow ? "url(#nc-glow)" : undefined}
      />

      <path
        d="M48.5 12.5l1.02 2.98L52.5 16.5l-2.98 1.02L48.5 20.5l-1.02-2.98L44.5 16.5l2.98-1.02L48.5 12.5z"
        fill="#f6d79a"
        fillOpacity="0.92"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-name ${className}`}>
      Nim<em>Cuet</em>
    </span>
  );
}

export function BrandLockup({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`brand-lockup ${className}`}>
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}
