'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  speed: number;
  phase: number;
}

const STAR_COUNT = 120;

export default function Stars({ health }: { health: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number>(0);
  const healthRef = useRef(health);

  useEffect(() => { healthRef.current = health; }, [health]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    onResize();
    window.addEventListener('resize', onResize);

    starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.65,
      size: Math.random() * 1.4 + 0.3,
      baseOpacity: Math.random() * 0.5 + 0.2,
      speed: Math.random() * 0.015 + 0.004,
      phase: Math.random() * Math.PI * 2,
    }));

    const ctx = canvas.getContext('2d')!;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dimFactor = Math.max(0.08, 1 - healthRef.current * 0.72);

      for (const s of starsRef.current) {
        const twinkle = Math.sin(t * s.speed + s.phase) * 0.3 + 0.7;
        const alpha = s.baseOpacity * twinkle * dimFactor;
        ctx.beginPath();
        ctx.arc(
          s.x * canvas.width,
          s.y * canvas.height,
          s.size * dpr,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(232, 228, 222, ${alpha})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
