const BG: Array<[string, string, string]> = [
  ["authbg-light", "/auth/bg-light.jpg", "var(--bg)"],
  ["authbg-midnight", "/auth/bg-midnight.jpg", "#070b18"],
  ["authbg-ocean", "/auth/bg-ocean.jpg", "#0c2a3f"],
  ["authbg-forest", "/auth/bg-forest.jpg", "#0b1512"],
  ["authbg-sunset", "/auth/bg-sunset.jpg", "#431407"],
];

export default function AuthBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {BG.map(([cls, src, fallback]) => (
        <img
          key={cls}
          src={src}
          alt=""
          loading="eager"
          className={`authbg absolute inset-0 h-full w-full object-cover ${cls}`}
          style={{ background: fallback, filter: "saturate(1.25)" }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 58%, transparent), color-mix(in srgb, var(--bg) 80%, transparent))", backdropFilter: "blur(3px)" }}
      />
    </div>
  );
}
