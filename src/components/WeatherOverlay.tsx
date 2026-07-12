/**
 * WeatherOverlay — the dial's weather made visible at ground level.
 *
 * When you are down low over a site or battlefield with the Weather & Sky
 * frame open, the dial's cloud and temperature paint the air itself:
 * heavy cloud brings rain, freezing turns it to drifting snow, furnace
 * heat rains fire, and a storm-dark sky cracks with lightning. Pure
 * screen-space canvas — zero cost to the globe, gone when you zoom out.
 */
import { useEffect, useRef } from 'react';

interface WeatherOverlayProps {
  temperature: number;
  cloud: number;
  active: boolean;
  reduceMotion: boolean;
}

interface Drop {
  x: number;
  y: number;
  v: number; // fall speed px/s
  drift: number; // sideways px/s
  len: number; // streak length (rain/fire) or flake radius (snow)
}

export default function WeatherOverlay({ temperature, cloud, active, reduceMotion }: WeatherOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ temperature, cloud });
  stateRef.current = { temperature, cloud };

  const on = active && !reduceMotion && cloud >= 0.55;

  useEffect(() => {
    if (!on) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let flashUntil = 0;
    let nextFlash = last + 2500 + Math.random() * 5000;
    const drops: Drop[] = [];

    const fit = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    fit();
    window.addEventListener('resize', fit);

    const spawn = (kind: 'rain' | 'snow' | 'fire'): Drop => ({
      x: Math.random() * (canvas.width + 200) - 100,
      y: -20 - Math.random() * canvas.height,
      v: kind === 'snow' ? 40 + Math.random() * 50 : 550 + Math.random() * 350,
      drift: kind === 'snow' ? (Math.random() - 0.5) * 60 : 40 + Math.random() * 50,
      len: kind === 'snow' ? 1.5 + Math.random() * 2.2 : 9 + Math.random() * 14,
    });

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { temperature: t, cloud: c } = stateRef.current;
      const kind: 'rain' | 'snow' | 'fire' = t <= 0 ? 'snow' : t >= 38 ? 'fire' : 'rain';
      const strength = Math.min(1, (c - 0.55) / 0.45);
      const want = Math.round(strength * (kind === 'snow' ? 260 : 180));

      while (drops.length < want) drops.push(spawn(kind));
      drops.length = Math.min(drops.length, want);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle =
        kind === 'fire' ? 'rgba(255,140,50,0.75)' : 'rgba(190,215,245,0.55)';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = kind === 'fire' ? 2.2 : 1.3;
      ctx.beginPath();
      for (const d of drops) {
        d.y += d.v * dt;
        d.x += d.drift * dt + (kind === 'snow' ? Math.sin(now / 900 + d.len * 7) * 0.6 : 0);
        if (d.y > canvas.height + 20) {
          d.y = -20;
          d.x = Math.random() * (canvas.width + 200) - 100;
        }
        if (kind === 'snow') {
          ctx.moveTo(d.x + d.len, d.y);
          ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2);
        } else {
          const slant = d.drift / d.v;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * slant * 6, d.y - d.len);
        }
      }
      if (kind === 'snow') ctx.fill();
      else ctx.stroke();

      // A storm-dark sky cracks with light now and then.
      if (c > 0.8 && kind !== 'fire') {
        if (now > nextFlash) {
          flashUntil = now + 130;
          nextFlash = now + 3000 + Math.random() * 6000;
        }
        if (now < flashUntil) {
          ctx.fillStyle = `rgba(255,255,255,${0.35 * ((flashUntil - now) / 130)})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, [on]);

  if (!on) return null;
  return <canvas ref={canvasRef} className="weather-overlay" aria-hidden="true" />;
}
