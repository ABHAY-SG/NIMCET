"use client";
import { useEffect, useRef } from "react";

type P = { x: number; y: number; vx: number; vy: number; r: number; accent: boolean; tw: number };

export default function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let pts: P[] = [];
    let raf = 0;
    let ink = "#ffffff";
    let accent = "#22d3ee";

    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--text").trim() || "#ffffff";
      accent = cs.getPropertyValue("--accent").trim() || "#22d3ee";
    };

    const seed = () => {
      const n = Math.min(110, Math.floor((W * H) / 14000));
      pts = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 0.6 + Math.random() * 1.8,
        accent: i % 9 === 0,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const parent = cv.parentElement;
      if (!parent) return;
      W = cv.width = parent.clientWidth;
      H = cv.height = parent.clientHeight;
      seed();
    };

    let t = 0;
    const draw = () => {
      t += 0.02;
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 90 * 90) {
            ctx.strokeStyle = ink;
            ctx.globalAlpha = 0.1 * (1 - Math.sqrt(d2) / 90);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        const glow = 0.45 + 0.4 * Math.sin(t + p.tw);
        ctx.globalAlpha = p.accent ? Math.min(1, glow + 0.25) : glow * 0.7;
        ctx.fillStyle = p.accent ? accent : ink;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.accent) {
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    readTheme();
    resize();
    draw();
    window.addEventListener("resize", resize);
    const mo = new MutationObserver(readTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      mo.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}
