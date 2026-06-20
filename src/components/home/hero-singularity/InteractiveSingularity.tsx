import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useThemeStore } from '@/stores/theme-store';
import { useSingularity } from './HeroElementDistortionProvider';

/**
 * Particle Class
 * Represents a single orbital mass with physics and theme-awareness.
 */
class Particle {
  angle: number;
  radius: number;
  baseRadius: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  jitterFreq: number;
  jitterAmount: number;
  opacity: number;
  baseOpacity: number;

  constructor(radius: number, index: number) {
    this.angle = Math.random() * Math.PI * 2;
    this.baseRadius = radius;
    this.radius = radius * (0.95 + Math.random() * 0.1);
    this.size = 1 + Math.random() * 2.5;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.05;
    this.jitterFreq = 0.001 + Math.random() * 0.002;
    this.jitterAmount = 1 + Math.random() * 3;
    const ringDepth = Math.min(index / 4, 1);
    this.baseOpacity = 0.3 + (1 - ringDepth) * 0.4;
    this.opacity = this.baseOpacity;
  }

  update(deltaTime: number, velocity: number, isWaveActive: boolean) {
    this.angle += velocity * (deltaTime / 16);
    this.rotation += this.rotationSpeed * (deltaTime / 16);
    const targetOpacity = isWaveActive ? Math.min(this.baseOpacity + 0.3, 1) : this.baseOpacity;
    this.opacity += (targetOpacity - this.opacity) * 0.1;
  }

  draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, isLight: boolean, isWaveActive: boolean) {
    const time = Date.now();
    const x = centerX + Math.cos(this.angle) * this.radius + Math.sin(time * this.jitterFreq) * this.jitterAmount;
    const y = centerY + Math.sin(this.angle) * this.radius + Math.cos(time * this.jitterFreq) * this.jitterAmount;
    const scale = isWaveActive ? 1.2 : 1;
    const finalSize = this.size * scale;

    // PERFORMANCE FIX: ctx.shadowBlur was being set per-particle, per-frame.
    // shadowBlur forces the canvas backend to run a separate blur
    // compositing pass for every single draw call — with up to ~1,200
    // particles on a desktop viewport, that's ~1,200 extra blur passes,
    // 60 times a second, running continuously from the moment the hero
    // mounts. Dropping it removes the single biggest cost in this loop;
    // the plain fill still reads clearly at this particle size.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = isLight
      ? `rgba(40, 40, 40, ${this.opacity})`
      : `rgba(255, 255, 240, ${this.opacity})`;
    ctx.fillRect(-finalSize / 2, -finalSize / 2, finalSize, finalSize);
    ctx.restore();
  }
}

class Ring {
  particles: Particle[] = [];
  velocity: number;

  constructor(radius: number, count: number, index: number) {
    // Keplerian-inspired velocity: inner rings move faster (v ∝ 1/√r)
    const baseRadius = 120;
    const baseVelocity = 0.015;
    this.velocity = baseVelocity / Math.sqrt(radius / baseRadius);
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(radius, index));
    }
  }

  update(deltaTime: number, isWaveActive: boolean) {
    this.particles.forEach(p => p.update(deltaTime, this.velocity, isWaveActive));
  }

  draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, isLight: boolean, isWaveActive: boolean) {
    this.particles.forEach(p => p.draw(ctx, centerX, centerY, isLight, isWaveActive));
  }
}

// ── Derive ring config purely from the live container width ──────────────────
function getRingConfig(width: number): { radii: number[]; particleMultiplier: number } {
  if (width <= 0)  return { radii: [80, 140],               particleMultiplier: 0.5  };
  if (width < 360) return { radii: [width * 0.18, width * 0.32],                           particleMultiplier: 0.4  };
  if (width < 480) return { radii: [width * 0.20, width * 0.34, width * 0.48],             particleMultiplier: 0.55 };
  if (width < 768) return { radii: [width * 0.18, width * 0.29, width * 0.40],             particleMultiplier: 0.75 };
  return               { radii: [width * 0.15, width * 0.24, width * 0.33, width * 0.42], particleMultiplier: 1.0  };
}

// ── Core body size derived from container width ──────────────────────────────
function getCoreSize(width: number): { size: string; ringSize: string } {
  // clamp between small phones and large desktops
  // result is a CSS value string e.g. "clamp(100px, 35%, 208px)"
  if (width <= 0) return { size: 'clamp(100px, 35%, 160px)', ringSize: 'clamp(110px, 38%, 176px)' };
  const minPx = Math.max(80,  Math.round(width * 0.22));
  const maxPx = Math.min(208, Math.round(width * 0.38));
  const minRing = Math.round(minPx * 1.1);
  const maxRing = Math.round(maxPx * 1.1);
  return {
    size:     `clamp(${minPx}px, 32%, ${maxPx}px)`,
    ringSize: `clamp(${minRing}px, 35%, ${maxRing}px)`,
  };
}

interface Props {
  /** Live container width fed from HeroSingularity via ResizeObserver */
  containerWidth?: number;
}

export const InteractiveSingularity = ({ containerWidth = 0 }: Props) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLight      = useThemeStore((s) => s.theme === 'light');
  const { waveCount, isEmitting } = useSingularity();
  const [waveIds, setWaveIds] = useState<number[]>([]);

  const ringsRef    = useRef<Ring[]>([]);
  const requestRef  = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // ── Canvas resize: driven by ResizeObserver on the wrapper (via containerWidth prop)
  //    Falls back to local containerRef measurement if prop is 0
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const applySize = (w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;

      const { radii, particleMultiplier } = getRingConfig(w);
      // PERFORMANCE FIX: base count was 300/ring — up to ~1,200 particles
      // drawn every frame on desktop (4 rings × 300). Combined with the
      // removed shadowBlur above, 140/ring keeps the band looking dense
      // while cutting per-frame draw-call volume by more than half.
      ringsRef.current = radii.map((r, i) =>
        new Ring(r, Math.floor(140 * particleMultiplier), i)
      );
    };

    // Use the prop width if available, otherwise measure locally
    const w = containerWidth > 0 ? containerWidth : el.clientWidth;
    const h = el.clientHeight;
    applySize(w, h);

    // Also keep a local ResizeObserver as fallback
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      applySize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerWidth]);

  // ── Animation loop
  useEffect(() => {
    const animate = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const centerX = canvas.width  / (2 * dpr);
      const centerY = canvas.height / (2 * dpr);

      ringsRef.current.forEach(ring => {
        ring.update(deltaTime, isEmitting);
        ring.draw(ctx, centerX, centerY, isLight, isEmitting);
      });

      ctx.restore();
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isLight, isEmitting]);

  // ── Sync SVG waves with context
  useEffect(() => {
    if (waveCount > 0) {
      setWaveIds(prev => [...prev.slice(-4), Date.now()]);
    }
  }, [waveCount]);

  // Derived sizes — recomputed whenever containerWidth changes
  const { size: coreSize, ringSize } = useMemo(
    () => getCoreSize(containerWidth),
    [containerWidth]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center select-none pointer-events-none overflow-visible"
    >
      {/* ── Layer 1: Ambient Depth Glow ── */}
      <div
        className={`absolute inset-0 rounded-full blur-[120px] transition-all duration-1000 opacity-30 ${
          isLight ? 'bg-steami-cyan/40 scale-110' : 'bg-steami-gold/30 scale-125'
        }`}
      />

      {/* ── Layer 2: Particle Ring Canvas ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 will-change-transform opacity-80"
        style={{ transform: 'translateZ(0)' }}
      />

      {/* ── Layer 3: Static Concentric Rotation Rings ──
          Radii are now driven by containerWidth so they scale on every device.
          On a 320 px phone the rings are proportionally small;
          on a 1440 px desktop they expand to fill the column. */}
      <div className="absolute inset-0 flex items-center justify-center overflow-visible z-0">
        {[0, 1, 2].map((i) => {
          // Base ring diameter: 55 % / 80 % / 105 % of container width
          const pct = 55 + i * 25; // 55, 80, 105
          const minPx = 120 + i * 80;
          const maxPx = 500 + i * 120;
          const dim = containerWidth > 0
            ? `clamp(${minPx}px, ${pct}%, ${maxPx}px)`
            : `clamp(${minPx}px, ${20 + i * 20}vw, ${maxPx}px)`;
          return (
            <div
              key={i}
              className={`absolute rounded-full border border-dashed transition-all duration-1000 ${
                isLight ? 'border-steami-cyan/5' : 'border-white/5'
              }`}
              style={{
                width: dim,
                height: dim,
                animation: `spin ${30 + i * 15}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}`,
              }}
            />
          );
        })}
      </div>

      {/* ── Layer 4: Radial Wave Propagation (SVG) ── */}
      <svg className="absolute inset-0 w-full h-full overflow-visible z-20" viewBox="0 0 100 100">
        {waveIds.map(id => (
          <circle
            key={id}
            cx="50"
            cy="50"
            r="0"
            fill="none"
            stroke={isLight ? 'rgba(111,168,255,0.4)' : 'rgba(255,255,255,0.3)'}
            strokeWidth="0.2"
            className="animate-celestial-ripple"
          />
        ))}
      </svg>

      {/* ── Layer 5: Core Celestial Body ──
          Width/height now use the derived coreSize so on an iPhone SE
          (375 px) the core is ~83 px, on a Galaxy Tab A (768 px) ~175 px,
          and on desktop ~208 px. Previously it was locked to Tailwind's
          w-40 (160 px) / w-52 (208 px) which was too large for small phones
          and never matched the 624 px canvas assumption. */}
      <div className="relative flex items-center justify-center group z-30">
        <div
          className={`relative rounded-full transition-all duration-1000 ${
            isLight
              ? 'bg-zinc-950 shadow-[0_0_80px_rgba(0,0,0,0.9),inset_0_0_40px_rgba(111,168,255,0.1)]'
              : 'bg-white shadow-[0_0_100px_rgba(255,255,255,0.95),0_0_160px_rgba(232,184,75,0.4)]'
          }`}
          style={{ width: coreSize, height: coreSize }}
        >
          <div className={`absolute inset-0 rounded-full blur-[4px] opacity-30 animate-pulse ${
            isLight ? 'bg-steami-cyan' : 'bg-steami-gold'
          }`} />
          <div className={`absolute inset-[2%] rounded-full ${
            isLight ? 'bg-zinc-950' : 'bg-white'
          }`} />
        </div>

        <div
          className={`absolute rounded-full border transition-all duration-1000 blur-[2px] animate-pulse ${
            isLight ? 'border-steami-gold/20' : 'border-steami-cyan/20'
          }`}
          style={{ width: ringSize, height: ringSize }}
        />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .animate-celestial-ripple {
          animation: celestial-ripple 6s cubic-bezier(0, 0.2, 0.8, 1) forwards;
        }
        @keyframes celestial-ripple {
          0%   { r: 0;   opacity: 0.8; stroke-width: 1;   }
          100% { r: 120; opacity: 0;   stroke-width: 0.1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-celestial-ripple,
          [style*="animation: spin"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
};
