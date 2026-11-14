import { useEffect, useRef } from 'react';
import { useStore } from './store';

/**
 * Glowing sound-wave line across the screen. Calm when idle,
 * lively while listening or signing.
 */
export function Wave({ listening }: { listening: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(listening);
  live.current = listening;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let amp = 0.1;
    const layers = [
      { color: '#22d3ee', speed: 1.6, freq: 2.2, scale: 1 },
      { color: '#3b82f6', speed: -1.1, freq: 3.1, scale: 0.75 },
      { color: '#a5f3fc', speed: 2.3, freq: 1.5, scale: 0.55 },
      { color: '#6366f1', speed: -2.0, freq: 4.0, scale: 0.4 },
    ];

    const draw = (ms: number) => {
      const t = ms / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const target = useStore.getState().playing ? 1.6 : live.current ? 1 : 0.1;
      amp += (target - amp) * 0.06;
      const mid = h / 2;

      ctx.globalCompositeOperation = 'lighter';
      for (const L of layers) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const u = x / w;
          // moving bumps, fading out toward the edges
          const env = Math.sin(Math.PI * u) ** 2 * (0.55 + 0.45 * Math.sin(u * 9 - t * L.speed * 0.7));
          const y = mid + Math.sin(u * Math.PI * 2 * L.freq + t * L.speed * 2) * env * amp * L.scale * (h * 0.38);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = L.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = L.color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
      }
      // bright core line
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(34,211,238,0)');
      g.addColorStop(0.5, 'rgba(165,243,252,0.9)');
      g.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = g;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#22d3ee';
      ctx.fillRect(0, mid - 1, w, 2);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="wave" />;
}
