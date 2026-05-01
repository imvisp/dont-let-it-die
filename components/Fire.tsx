'use client';

import { useEffect, useRef } from 'react';

const W = 360;
const H = 300;
const CX = 180;
const CY = 138;
const SEAT_RADIUS = 78;
const SEAT_ANGLES = [0.15, 0.35, 0.5, 0.65, 0.85].map(a => a * Math.PI);

const PHASE_SIT = 0;
const PHASE_STAND = 1;
const PHASE_WALK_TO = 2;
const PHASE_ADD = 3;
const PHASE_WALK_BACK = 4;
const PHASE_SIT_DOWN = 5;
const PHASE_DURATIONS = [0, 380, 700, 520, 700, 380];

const FIRE_X = CX;
const FIRE_Y = CY + 22;

const PALETTES = [
  { skin: '#C4956A', shirt: '#6D5D52', pants: '#4A3F37', hair: '#3B2F26' },
  { skin: '#D4A574', shirt: '#5B6858', pants: '#3C403A', hair: '#2E2418' },
  { skin: '#B8845C', shirt: '#87695A', pants: '#4D4138', hair: '#1E1610' },
  { skin: '#CAAA82', shirt: '#665873', pants: '#3C3545', hair: '#2A2030' },
  { skin: '#BFA07A', shirt: '#74564B', pants: '#44383A', hair: '#352820' },
] as const;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; hue: number;
}

interface Ember {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  drift: number; driftPhase: number;
}

interface Smoke {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  radius: number;
}

interface CharState {
  seatX: number; seatY: number;
  phase: number; phaseStart: number;
  bobPhase: number;
  palette: typeof PALETTES[number];
}

export interface FireCanvasProps {
  health: number;
  logs: number;
  alive: boolean;
  animTick: number;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export default function FireCanvas({ health, logs, alive, animTick }: FireCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const healthRef = useRef(health);
  const logsRef = useRef(logs);
  const aliveRef = useRef(alive);
  const animTickRef = useRef(animTick);
  const rafRef = useRef(0);

  const particlesRef = useRef<Particle[]>([]);
  const embersRef = useRef<Ember[]>([]);
  const smokeRef = useRef<Smoke[]>([]);
  const charsRef = useRef<CharState[]>([]);
  const animatingRef = useRef<number | null>(null);

  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { aliveRef.current = alive; }, [alive]);

  useEffect(() => {
    if (animTick === animTickRef.current) return;
    animTickRef.current = animTick;

    const chars = charsRef.current;
    if (!chars.length || animatingRef.current !== null) return;

    const sittingIdxs = chars
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.phase === PHASE_SIT)
      .map(({ i }) => i);
    if (!sittingIdxs.length) return;

    const idx = sittingIdxs[Math.floor(Math.random() * sittingIdxs.length)];
    animatingRef.current = idx;
    chars[idx].phase = PHASE_STAND;
    chars[idx].phaseStart = performance.now();
  }, [animTick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    charsRef.current = SEAT_ANGLES.map((angle, i) => ({
      seatX: CX + SEAT_RADIUS * Math.cos(Math.PI - angle),
      seatY: CY + SEAT_RADIUS * Math.sin(angle),
      phase: PHASE_SIT,
      phaseStart: 0,
      bobPhase: Math.random() * Math.PI * 2,
      palette: PALETTES[i],
    }));

    const ashDots = Array.from({ length: 9 }, (_, i) => ({
      x: CX + Math.cos((i / 9) * Math.PI * 2) * 20 + (i % 3 - 1) * 6,
      y: CY + 10 + Math.sin((i / 9) * Math.PI * 2) * 5 + (i % 2) * 3,
      r: 1.5 + (i % 3) * 0.8,
    }));

    function spawnParticle(): Particle {
      const h = healthRef.current;
      const spread = lerp(5, 20, h);
      return {
        x: CX + (Math.random() - 0.5) * spread,
        y: CY,
        vx: (Math.random() - 0.5) * lerp(0.4, 1.8, h),
        vy: -(lerp(1.0, 3.0, h) + Math.random() * lerp(0.6, 1.5, h)),
        life: lerp(35, 70, h) + Math.random() * 20,
        maxLife: lerp(35, 70, h) + Math.random() * 20,
        size: lerp(2.5, 6.5, h) + Math.random() * 2,
        hue: 12 + Math.random() * 36,
      };
    }

    function spawnEmber(): Ember {
      return {
        x: CX + (Math.random() - 0.5) * 18,
        y: CY - 8,
        vx: (Math.random() - 0.5) * 0.7,
        vy: -(0.6 + Math.random() * 1.4),
        life: 90 + Math.random() * 90,
        maxLife: 90 + Math.random() * 90,
        drift: (Math.random() - 0.5) * 0.04,
        driftPhase: Math.random() * Math.PI * 2,
      };
    }

    function spawnSmoke(): Smoke {
      return {
        x: CX + (Math.random() - 0.5) * 10,
        y: CY - 18,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.25 + Math.random() * 0.45),
        life: 130 + Math.random() * 60,
        maxLife: 130 + Math.random() * 60,
        radius: 7 + Math.random() * 10,
      };
    }

    function drawPerson(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      palette: typeof PALETTES[number],
      carrying: boolean,
      lean: number
    ) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lean);

      // Legs
      ctx.fillStyle = palette.pants;
      ctx.fillRect(-5, 4, 4, 9);
      ctx.fillRect(1, 4, 4, 9);

      // Body
      ctx.fillStyle = palette.shirt;
      ctx.fillRect(-6, -6, 12, 11);

      // Arms
      ctx.fillStyle = palette.skin;
      if (carrying) {
        ctx.fillRect(-10, -5, 4, 5);
        ctx.fillRect(6, -5, 4, 5);
        ctx.fillStyle = '#5C3D1E';
        ctx.fillRect(-12, -9, 24, 4);
      } else {
        ctx.fillRect(-9, -4, 4, 8);
        ctx.fillRect(5, -4, 4, 8);
      }

      // Head
      ctx.fillStyle = palette.skin;
      ctx.beginPath();
      ctx.arc(0, -12, 6, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = palette.hair;
      ctx.beginPath();
      ctx.arc(0, -12, 6, Math.PI, 2 * Math.PI);
      ctx.fill();
      ctx.fillRect(-6, -18, 12, 7);

      ctx.restore();
    }

    function drawChar(char: CharState, t: number) {
      const now = performance.now();
      const { phase, phaseStart, seatX, seatY, palette, bobPhase } = char;
      const duration = PHASE_DURATIONS[phase] || 1;
      const progress = duration > 0 ? clamp((now - phaseStart) / duration, 0, 1) : 0;

      let px = seatX;
      let py = seatY;
      let lean = 0;
      let carrying = false;

      switch (phase) {
        case PHASE_SIT:
        case PHASE_SIT_DOWN: {
          const bob = Math.sin(t * 0.0014 + bobPhase) * 0.7;
          py = seatY + bob + (phase === PHASE_SIT_DOWN ? (1 - progress) * -10 : 0);
          break;
        }
        case PHASE_STAND:
          py = seatY - progress * 9;
          break;
        case PHASE_WALK_TO:
          px = lerp(seatX, FIRE_X, progress);
          py = lerp(seatY, FIRE_Y, progress) + Math.sin(progress * Math.PI * 4) * 3;
          carrying = true;
          break;
        case PHASE_ADD:
          px = FIRE_X;
          py = FIRE_Y - progress * 7;
          lean = progress < 0.5 ? progress * 0.5 : (1 - progress) * 0.5;
          carrying = progress < 0.45;
          break;
        case PHASE_WALK_BACK:
          px = lerp(FIRE_X, seatX, progress);
          py = lerp(FIRE_Y, seatY, progress) + Math.sin(progress * Math.PI * 4) * 3;
          break;
      }

      drawPerson(ctx, px, py, palette, carrying, lean);
    }

    function drawLogs(h: number, logCount: number) {
      if (h === 0) {
        ctx.fillStyle = '#2E2C29';
        ctx.beginPath();
        ctx.ellipse(CX, CY + 10, 26, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3A3835';
        for (const d of ashDots) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      const count = Math.min(logCount, 3);
      const logPalette = h > 0.5
        ? ['#7A4E2D', '#6B4226', '#5C3D1E']
        : ['#3A2510', '#2E1E0A', '#241808'];
      const coalColor = h > 0.5 ? '#FF6B1A' : '#CC3A00';

      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.translate(CX, CY + 10 - i * 3);
        ctx.rotate((i - 1) * 0.28);
        ctx.fillStyle = logPalette[i % 3];
        ctx.beginPath();
        ctx.ellipse(0, 0, 22 - i * 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = coalColor;
        ctx.beginPath();
        ctx.arc(-(20 - i * 2), 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const coalGrad = ctx.createRadialGradient(CX, CY + 6, 0, CX, CY + 6, 20);
      coalGrad.addColorStop(0, `rgba(255, 100, 0, ${h * 0.55})`);
      coalGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coalGrad;
      ctx.beginPath();
      ctx.ellipse(CX, CY + 6, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw(t: number) {
      const h = healthRef.current;
      const logCount = logsRef.current;
      const alive = aliveRef.current;

      ctx.clearRect(0, 0, W, H);

      // Ambient fire glow
      if (alive && h > 0) {
        const r = lerp(50, 120, h);
        const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, r);
        g.addColorStop(0, `rgba(255, 120, 30, ${h * 0.22})`);
        g.addColorStop(0.5, `rgba(200, 70, 15, ${h * 0.10})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Ground reflection
      if (alive && h > 0.05) {
        const gr = ctx.createRadialGradient(CX, CY + 70, 0, CX, CY + 70, 90);
        gr.addColorStop(0, `rgba(180, 70, 15, ${h * 0.12})`);
        gr.addColorStop(1, 'transparent');
        ctx.fillStyle = gr;
        ctx.fillRect(0, CY, W, H - CY);
      }

      // Spawn fire particles
      if (alive && h > 0) {
        const target = Math.floor(lerp(8, 75, h));
        const toSpawn = Math.min(3, Math.max(0, target - particlesRef.current.length));
        for (let i = 0; i < toSpawn; i++) particlesRef.current.push(spawnParticle());

        if (h > 0.15 && Math.random() < h * 0.06 && embersRef.current.length < 28) {
          embersRef.current.push(spawnEmber());
        }
      }

      // Spawn smoke when low health
      if (h > 0 && h < 0.4) {
        if (Math.random() < 0.07 && smokeRef.current.length < 14) {
          smokeRef.current.push(spawnSmoke());
        }
      }

      // Draw smoke (behind fire)
      smokeRef.current = smokeRef.current.filter(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.vx += (Math.random() - 0.5) * 0.04;
        s.radius += 0.25;
        s.life -= 1;
        const p = 1 - s.life / s.maxLife;
        const alpha = Math.sin(p * Math.PI) * 0.1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 152, 142, ${alpha})`;
        ctx.fill();
        return s.life > 0;
      });

      // Draw fire particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.985;
        p.vx *= 0.975;
        p.life -= 1;
        const progress = 1 - p.life / p.maxLife;
        const alpha = Math.pow(1 - progress, 1.5) * h;
        const lightness = Math.floor(lerp(62, 28, progress));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 92%, ${lightness}%, ${alpha})`;
        ctx.fill();
        return p.life > 0;
      });

      // Draw embers
      embersRef.current = embersRef.current.filter(e => {
        e.x += e.vx + Math.sin(t * 0.002 + e.driftPhase) * e.drift * 12;
        e.y += e.vy;
        e.life -= 1;
        const p = 1 - e.life / e.maxLife;
        const alpha = Math.sin(p * Math.PI) * 0.95;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 190, 70, ${alpha})`;
        ctx.fill();
        return e.life > 0;
      });

      // Draw log base
      drawLogs(h, logCount);

      // Advance character animation phases
      const now = performance.now();
      const chars = charsRef.current;
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (c.phase === PHASE_SIT) continue;
        const elapsed = now - c.phaseStart;
        if (elapsed >= PHASE_DURATIONS[c.phase]) {
          const next = c.phase + 1;
          if (next > PHASE_SIT_DOWN) {
            c.phase = PHASE_SIT;
            if (animatingRef.current === i) animatingRef.current = null;
          } else {
            c.phase = next;
            c.phaseStart = now;
          }
        }
      }

      // Sort chars by Y for depth, draw
      const sorted = [...chars].map((c, i) => {
        let ry = c.seatY;
        if (c.phase === PHASE_WALK_TO) {
          const p = clamp((now - c.phaseStart) / PHASE_DURATIONS[PHASE_WALK_TO], 0, 1);
          ry = lerp(c.seatY, FIRE_Y, p);
        } else if (c.phase === PHASE_ADD || c.phase === PHASE_WALK_BACK) {
          ry = FIRE_Y;
        }
        return { c, i, ry };
      }).sort((a, b) => a.ry - b.ry);

      for (const { c } of sorted) drawChar(c, t);

      // Face glow from fire
      if (alive && h > 0.08) {
        for (const c of chars) {
          const dx = c.seatX - CX;
          const dy = c.seatY - CY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const intensity = clamp(1 - dist / (SEAT_RADIUS * 1.6), 0, 1) * h * 0.28;
          if (intensity < 0.01) continue;
          const fg = ctx.createRadialGradient(c.seatX, c.seatY - 12, 0, c.seatX, c.seatY - 12, 14);
          fg.addColorStop(0, `rgba(255, 155, 55, ${intensity})`);
          fg.addColorStop(1, 'transparent');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(c.seatX, c.seatY - 12, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
