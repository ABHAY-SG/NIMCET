"use client";
import { useEffect, useRef } from "react";

type P = { x: number; y: number; vx: number; vy: number; r: number; hot: boolean };

const LINK = 130;

// Slow-drifting constellation: muted dots, thin links when near, a few
// accent dots. Theme-aware, pauses offscreen, still on reduced-motion.
export default function Constellation() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let raf = 0;
    let pts: P[] = [];
    let ink = "#78716c";
    let accent = "#ea580c";
    let visible = true;

    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--muted").trim() || "#78716c";
      accent = cs.getPropertyValue("--accent").trim() || "#ea580c";
    };

    const seed = () => {
      const n = Math.min(85, Math.floor((W * H) / 22000));
      pts = Array.from({ length: Math.max(n, 24) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.8,
        hot: Math.random() < 0.12,
      }));
    };

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      W = Math.max(r.width, 1);
      H = Math.max(r.height, 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + (p.hot ? 1.4 : 0), 0, 7);
        ctx.fillStyle = p.hot ? accent : ink;
        ctx.globalAlpha = p.hot ? 0.9 : 0.55;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.globalAlpha = (1 - d / LINK) * 0.28;
            ctx.strokeStyle = ink;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      if (visible) {
        for (const p of pts) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x += W;
          if (p.x > W) p.x -= W;
          if (p.y < 0) p.y += H;
          if (p.y > H) p.y -= H;
        }
        draw();
      }
      raf = requestAnimationFrame(tick);
    };

    readTheme();
    fit();
    draw();
    if (!reduced) raf = requestAnimationFrame(tick);
    const io = new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; }));
    io.observe(cv);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
