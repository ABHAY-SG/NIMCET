"use client";
import { useEffect, useRef, useState } from "react";

const VIEW = 280;
const OUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, v));
}

// Square crop editor: drag to reposition, slider/buttons to zoom.
// Confirm renders a 512px JPEG blob of exactly the visible square.
export default function PhotoCropper({
  src,
  onCancel,
  onConfirm,
}: {
  src: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const im = new Image();
    im.onload = () => {
      if (!alive) return;
      setSize({ w: im.naturalWidth, h: im.naturalHeight });
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    im.src = src;
    return () => { alive = false; };
  }, [src]);

  // Displayed image dims at current zoom (cover-fit base × zoom).
  const base = size.w > 0 && size.h > 0 ? Math.max(VIEW / size.w, VIEW / size.h) : 1;
  const k = base * zoom;
  const dw = size.w * k;
  const dh = size.h * k;
  const cx = clamp(pos.x, -(dw - VIEW) / 2, (dw - VIEW) / 2);
  const cy = clamp(pos.y, -(dh - VIEW) / 2, (dh - VIEW) / 2);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLDivElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setPos({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
  };
  const endDrag = () => { dragRef.current = null; };

  const confirm = () => {
    if (size.w === 0 || busy) return;
    setBusy(true);
    const im = new Image();
    im.onload = () => {
      try {
        // Visible square maps back to this source rect.
        const side = VIEW / k;
        const sx = (size.w - side) / 2 - cx / k;
        const sy = (size.h - side) / 2 - cy / k;
        const canvas = document.createElement("canvas");
        canvas.width = OUT;
        canvas.height = OUT;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable.");
        ctx.drawImage(im, sx, sy, side, side, 0, 0, OUT, OUT);
        canvas.toBlob(
          (blob) => {
            setBusy(false);
            if (blob) onConfirm(blob);
          },
          "image/jpeg",
          0.9
        );
      } catch {
        setBusy(false);
      }
    };
    im.onerror = () => setBusy(false);
    im.src = src;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Crop profile photo">
      <button type="button" aria-label="Close crop editor" onClick={onCancel} className="absolute inset-0 cursor-default"
        style={{ background: "linear-gradient(180deg, rgba(10,14,28,0.55), rgba(10,14,28,0.75))", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
      <div className="relative w-full max-w-sm rounded-3xl p-6 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <h2 className="text-lg font-extrabold tracking-tight">Crop photo</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Drag to reposition • zoom to fit the square</p>
        <div
          className="relative mx-auto mt-4 touch-none select-none overflow-hidden rounded-2xl"
          style={{ width: VIEW, height: VIEW, maxWidth: "100%", background: "var(--pill)", border: "1px solid var(--border)", cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {size.w > 0 ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: dw,
                height: dh,
                transform: `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`,
              }}
            />
          ) : (
            <p className="mt-24 text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
          )}
        </div>
        <div className="mx-auto mt-4 flex max-w-[280px] items-center gap-2">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-base font-extrabold"
            style={{ border: "1px solid var(--border)" }}>−</button>
          <input
            type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} value={zoom} aria-label="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-current"
          />
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-base font-extrabold"
            style={{ border: "1px solid var(--border)" }}>+</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel}
            className="cursor-pointer rounded-xl py-2.5 text-sm font-bold"
            style={{ border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={busy || size.w === 0}
            className="cursor-pointer rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ background: "var(--btn-bg)", color: "var(--btn-text)" }}>
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
