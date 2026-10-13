"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

interface OrbProps {
  /** 0..1, the agent's voice */
  getOutputVolume?: () => number;
  /** 0..1, the client's mic */
  getInputVolume?: () => number;
  speaking: boolean;
  active: boolean;
}

/**
 * The agent's presence on screen: a soft, breathing light that swells with
 * whoever is talking. Warm when the agent speaks, cool cream while it listens.
 */
export function Orb({ getOutputVolume, getInputVolume, speaking, active }: OrbProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ speaking, active, level: 0, warm: 0 });
  const vol = useRef({ getOutputVolume, getInputVolume });
  useLayoutEffect(() => {
    state.current.speaking = speaking;
    state.current.active = active;
    vol.current = { getOutputVolume, getInputVolume };
  }, [speaking, active, getOutputVolume, getInputVolume]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = el.clientWidth * dpr;
      el.height = el.clientHeight * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const draw = (now: number) => {
      const s = state.current;
      const t = (now - t0) / 1000;
      let raw = 0;
      try {
        raw = s.speaking ? (vol.current.getOutputVolume?.() ?? 0) : (vol.current.getInputVolume?.() ?? 0) * 0.6;
      } catch {}
      const target = s.active ? Math.min(1, raw * 2.2) : 0;
      s.level += (target - s.level) * (target > s.level ? 0.35 : 0.08);
      s.warm += ((s.speaking ? 1 : 0) - s.warm) * 0.06;

      const w = el.width;
      const h = el.height;
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.22;
      const breathe = reduced ? 0 : Math.sin(t * 1.3) * 0.02;
      const r = base * (1 + breathe + s.level * 0.22);

      ctx.clearRect(0, 0, w, h);

      // Mix between listening cream and speaking ember
      const mix = (a: number[], b: number[]) => a.map((v, i) => Math.round(v + (b[i] - v) * s.warm));
      const core = mix([245, 239, 226], [240, 138, 62]);
      const edge = mix([150, 140, 125], [170, 60, 20]);

      // Halo
      const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, Math.min(w, h) * 0.5);
      halo.addColorStop(0, `rgba(${core.join(",")},${0.22 + s.level * 0.25})`);
      halo.addColorStop(1, `rgba(${core.join(",")},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // Wobbling layers
      const layers = reduced ? 1 : 3;
      for (let l = layers - 1; l >= 0; l--) {
        ctx.beginPath();
        const steps = 96;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const wob =
            Math.sin(a * 3 + t * (0.9 + l * 0.3)) * 0.022 +
            Math.sin(a * 5 - t * (1.4 + l * 0.2)) * 0.012 * (1 + s.level * 2.5);
          const rr = r * (1 + l * 0.07) * (1 + (reduced ? 0 : wob));
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r * 1.15);
        const alpha = l === 0 ? 1 : 0.18;
        g.addColorStop(0, `rgba(255,250,240,${alpha})`);
        g.addColorStop(0.35, `rgba(${core.join(",")},${alpha})`);
        g.addColorStop(1, `rgba(${edge.join(",")},${alpha * 0.9})`);
        ctx.fillStyle = g;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvas} className="h-full w-full" aria-hidden />;
}
