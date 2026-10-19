// The Android-app mark used by every "Get Android App" entry point — the filled
// play triangle shown on the landing page badge, so the hero and the dashboard
// carry the same symbol.
export default function AndroidAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      <path d="M9 6.2v11.6L19 12z" />
    </svg>
  );
}
