import type { CSSProperties } from "react";

/** Use the exact transparent NimCuet wordmark shipped on the website. */
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
    <img
      src="/logo.png"
      width={size * (447 / 113)}
      height={size}
      alt="NimCuet"
      className={className}
      style={{
        width: size * (447 / 113),
        height: size,
        objectFit: "contain",
        filter: glow ? "drop-shadow(0 0 8px rgba(233, 199, 126, 0.48))" : undefined,
        ...style,
      }}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="NimCuet"
      className={className}
      style={{ display: "block", width: 25 * (447 / 113), height: 25, objectFit: "contain" }}
    />
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
    </span>
  );
}
