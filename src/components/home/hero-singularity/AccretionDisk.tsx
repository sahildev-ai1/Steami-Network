/**
 * AccretionDisk — Interstellar visual reference redesign (v3)
 * ─────────────────────────────────────────────────────────────
 *
 * Approach: The entire disk is drawn as ONE wide SVG at a canvas of
 * 800 × 480 (viewBox). The equatorial plane of the black hole sits at y=240
 * (exact vertical center). All arcs and lines use y=240 as their anchor.
 *
 * Key visual elements:
 *   BACKGROUND layer (z:1):
 *     - Broad diffuse warm halo behind everything
 *     - Far-side top lensing arcs (orange, warm)
 *     - Dark gravitational shadow mass — SVG path above and below disk
 *
 *   FOREGROUND layer (z:15):
 *     - Main accretion WAVE: 3-layer (blurred halo + solid band + hot core)
 *     - Near-side bottom lensing arc
 *     - Lensing contour lines above event horizon
 *     - Glowing particles + heat shimmer streaks
 *
 * Colors (dark/light): amber / orange / red / yellow — NO blue/cyan on disk.
 * The SVG uses CSS @keyframes for animated path `d` attributes.
 */
import { motion } from 'framer-motion';
import { useThemeStore } from '@/stores/theme-store';
import { useEffect } from 'react';

// ── One-time CSS keyframe injection ──────────────────────────────────────────
let _kfInjected = false;
const injectKeyframes = () => {
  if (_kfInjected || typeof document === 'undefined') return;
  _kfInjected = true;
  const s = document.createElement('style');
  // NOTE: all y-coords use 240 (center of 480px canvas)
  s.textContent = `
    @keyframes bh-arc-top {
      0%,100% { d: path("M 100 240 C 190 115, 615 115, 700 240"); }
      50%      { d: path("M 100 240 C 190 100, 615 100, 700 240"); }
    }
    @keyframes bh-arc-top2 {
      0%,100% { d: path("M  60 240 C 190  85, 615  85, 740 240"); }
      50%      { d: path("M  60 240 C 190  70, 615  70, 740 240"); }
    }
    @keyframes bh-arc-top3 {
      0%,100% { d: path("M  30 240 C 190  65, 615  65, 770 240"); }
      50%      { d: path("M  30 240 C 190  50, 615  50, 770 240"); }
    }
    @keyframes bh-arc-bot {
      0%,100% { d: path("M 130 240 C 215 345, 590 345, 670 240"); }
      50%      { d: path("M 130 240 C 215 365, 590 365, 670 240"); }
    }
    @keyframes bh-arc-bot2 {
      0%,100% { d: path("M  90 240 C 215 380, 590 380, 710 240"); }
      50%      { d: path("M  90 240 C 215 405, 590 405, 710 240"); }
    }
    @keyframes bh-band-pulse {
      0%,100% { stroke-width: 32; opacity: 0.85; }
      50%      { stroke-width: 44; opacity: 1.00; }
    }
    @keyframes bh-band-mid {
      0%,100% { stroke-width: 14; opacity: 0.95; }
      50%      { stroke-width: 18; opacity: 1.00; }
    }
    @keyframes bh-band-core {
      0%,100% { stroke-width: 4; opacity: 0.98; }
      50%      { stroke-width: 6; opacity: 1.00; }
    }
    @keyframes bh-shadow-top {
      0%,100% { opacity: 0.68; }
      50%      { opacity: 0.85; }
    }
    @keyframes bh-shadow-bot {
      0%,100% { opacity: 0.56; }
      50%      { opacity: 0.76; }
    }
    @keyframes bh-p0 { 0%,100%{opacity:0;cx:175} 40%{opacity:1} 75%{opacity:0.3;cx:210} }
    @keyframes bh-p1 { 0%,100%{opacity:0;cx:625} 40%{opacity:1} 75%{opacity:0.3;cx:592} }
    @keyframes bh-p2 { 0%,100%{opacity:0;cx: 90} 40%{opacity:0.8} 70%{opacity:0.1;cx:120} }
    @keyframes bh-p3 { 0%,100%{opacity:0;cx:710} 40%{opacity:0.8} 70%{opacity:0.1;cx:680} }
    @keyframes bh-p4 { 0%,100%{opacity:0;cx:250} 40%{opacity:0.9} 70%{opacity:0.3;cx:278} }
    @keyframes bh-p5 { 0%,100%{opacity:0;cx:550} 40%{opacity:0.9} 70%{opacity:0.3;cx:522} }
    @keyframes bh-p6 { 0%,100%{opacity:0;cx:340} 40%{opacity:0.7} 70%{opacity:0.2;cx:362} }
    @keyframes bh-p7 { 0%,100%{opacity:0;cx:460} 40%{opacity:0.7} 70%{opacity:0.2;cx:438} }
    @keyframes bh-sh0 { 0%,100%{opacity:0} 50%{opacity:0.75} }
    @keyframes bh-sh1 { 0%,100%{opacity:0} 50%{opacity:0.65} }
    @keyframes bh-sh2 { 0%,100%{opacity:0} 50%{opacity:0.70} }
    @keyframes bh-sh3 { 0%,100%{opacity:0} 50%{opacity:0.60} }
    @keyframes bh-sh4 { 0%,100%{opacity:0} 50%{opacity:0.68} }
    @keyframes bh-shimmer-drift {
      0%   { opacity: 0.0; transform: translateX(-4px); }
      40%  { opacity: 0.9; transform: translateX(0px);  }
      100% { opacity: 0.0; transform: translateX( 4px); }
    }
  `;
  document.head.appendChild(s);
};

// ── Theme color tokens ────────────────────────────────────────────────────────
const dark = {
  waveOuter:  'rgba(160, 38,  4, 0.00)',  // transparent edge
  waveFar:    'rgba(195, 58, 10, 0.75)',  // deep crimson-orange tail
  waveMid:    'rgba(240,118, 28, 0.95)',  // warm orange
  waveCore:   'rgba(255,200, 55, 1.00)',  // bright yellow-gold center
  waveHot:    'rgba(255,245,170, 1.00)',  // near-white-hot spine
  arcFar:     'rgba(255,140, 28, 0.72)',  // far-side lensed arc
  arcFarOut:  'rgba(200, 70, 10, 0.30)',
  contour:    'rgba(255,190, 50, 0.22)',
  shadow:     '#050912',                  // near-black gravitational shadow
};
const light = {
  waveOuter:  'rgba(190, 68, 12, 0.00)',
  waveFar:    'rgba(205, 80, 20, 0.60)',
  waveMid:    'rgba(242,132, 40, 0.85)',
  waveCore:   'rgba(255,195, 55, 0.98)',
  waveHot:    'rgba(255,240,150, 1.00)',
  arcFar:     'rgba(245,145, 40, 0.60)',
  arcFarOut:  'rgba(200, 80, 20, 0.22)',
  contour:    'rgba(255,175, 40, 0.18)',
  shadow:     '#0a1020',
};

// ── SVG canvas dimensions ─────────────────────────────────────────────────────
// Width 800, Height 480. Equatorial center = y:240
const W = 800;
const CY = 240; // centre Y

// ─── Background layer ─────────────────────────────────────────────────────────
export const AccretionDiskBackground = () => {
  const isLight = useThemeStore((s) => s.theme === 'light');
  useEffect(() => { injectKeyframes(); }, []);
  const t = isLight ? light : dark;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.8 }}
      style={{ zIndex: 1, overflow: 'visible', width: '100%', height: '100%' }}
    >
      <svg
        viewBox={`0 0 ${W} 480`}
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible', minWidth: 0 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Horizontal wave gradient — fiery */}
          <linearGradient id="bhBgWaveGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor={t.waveOuter} />
            <stop offset="10%"  stopColor={t.waveFar}   />
            <stop offset="30%"  stopColor={t.waveMid}   />
            <stop offset="50%"  stopColor={t.waveCore}  />
            <stop offset="70%"  stopColor={t.waveMid}   />
            <stop offset="90%"  stopColor={t.waveFar}   />
            <stop offset="100%" stopColor={t.waveOuter} />
          </linearGradient>

          {/* Arc gradient */}
          <linearGradient id="bhBgArcGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor="transparent"  />
            <stop offset="20%"  stopColor={t.arcFarOut}  />
            <stop offset="50%"  stopColor={t.arcFar}     />
            <stop offset="80%"  stopColor={t.arcFarOut}  />
            <stop offset="100%" stopColor="transparent"  />
          </linearGradient>

          {/* Glow filter for arcs */}
          <filter id="bhBgGlow" x="-60%" y="-400%" width="220%" height="900%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Soft blur for dark shadow masses */}
          <filter id="bhShadowBlur" x="-25%" y="-50%" width="150%" height="200%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        {/* ── Wide blurred warm halo — sets the warm atmospheric tone ── */}
        <rect
          x="0" y={CY - 60} width={W} height="120"
          fill="url(#bhBgWaveGrad)"
          style={{ filter: 'blur(32px)', opacity: 0.50 }}
        />

        {/* ────────────────────────────────────────────────────────────────────
            GRAVITATIONAL SHADOW MASSES
            Two dark blob shapes that create the "folded disk" lensing look.
            Upper mass: the dark region above the equatorial band
            Lower mass: the dark region below
        ──────────────────────────────────────────────────────────────────── */}

        {/* Upper dark gravitational shadow */}
        <ellipse
          cx={W / 2} cy={CY - 55} rx="200" ry="42"
          fill={t.shadow}
          style={{
            filter: 'url(#bhShadowBlur)',
            opacity: 0.82,
            animation: 'bh-shadow-top 9s ease-in-out infinite',
          }}
        />

        {/* Lower dark gravitational shadow */}
        <ellipse
          cx={W / 2} cy={CY + 55} rx="190" ry="38"
          fill={t.shadow}
          style={{
            filter: 'url(#bhShadowBlur)',
            opacity: 0.70,
            animation: 'bh-shadow-bot 9s ease-in-out infinite',
          }}
        />

        {/* ────────────────────────────────────────────────────────────────────
            FAR-SIDE LENSING ARCS (above the equator — gravitational lensing)
        ──────────────────────────────────────────────────────────────────── */}

        {/* Inner primary arc */}
        <path
          d={`M 100 ${CY} C 190 80, 615 80, 700 ${CY}`}
          fill="none"
          stroke="url(#bhBgArcGrad)"
          strokeWidth="24"
          style={{
            filter: 'url(#bhBgGlow)',
            opacity: 0.90,
            animation: 'bh-arc-top 13s ease-in-out infinite',
          }}
        />

        {/* Secondary wider arc */}
        <path
          d={`M 60 ${CY} C 190 30, 615 30, 740 ${CY}`}
          fill="none"
          stroke="url(#bhBgArcGrad)"
          strokeWidth="10"
          style={{
            filter: 'url(#bhBgGlow)',
            opacity: 0.48,
            animation: 'bh-arc-top2 17s ease-in-out infinite',
            animationDelay: '0.7s',
          }}
        />

        {/* Tertiary faintest arc */}
        <path
          d={`M 30 ${CY} C 190 6, 615 6, 770 ${CY}`}
          fill="none"
          stroke="url(#bhBgArcGrad)"
          strokeWidth="4"
          style={{
            opacity: 0.24,
            filter: 'blur(5px)',
            animation: 'bh-arc-top3 22s ease-in-out infinite',
            animationDelay: '1.4s',
          }}
        />
      </svg>
    </motion.div>
  );
};

// ─── Foreground layer ─────────────────────────────────────────────────────────
export const AccretionDiskForeground = () => {
  const isLight = useThemeStore((s) => s.theme === 'light');
  useEffect(() => { injectKeyframes(); }, []);
  const t = isLight ? light : dark;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.8, delay: 0.5 }}
      style={{ zIndex: 15, overflow: 'visible', width: '100%', height: '100%' }}
    >
      <svg
        viewBox={`0 0 ${W} 480`}
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible', minWidth: 0 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Main accretion wave gradient */}
          <linearGradient id="bhFgWaveGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor={t.waveOuter} />
            <stop offset="8%"   stopColor={t.waveFar}   />
            <stop offset="26%"  stopColor={t.waveMid}   />
            <stop offset="50%"  stopColor={t.waveCore}  />
            <stop offset="74%"  stopColor={t.waveMid}   />
            <stop offset="92%"  stopColor={t.waveFar}   />
            <stop offset="100%" stopColor={t.waveOuter} />
          </linearGradient>

          {/* White-hot core only near center */}
          <linearGradient id="bhFgHotGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor="transparent"  />
            <stop offset="32%"  stopColor={t.waveCore}   stopOpacity="0.35" />
            <stop offset="50%"  stopColor={t.waveHot}    stopOpacity="1"    />
            <stop offset="68%"  stopColor={t.waveCore}   stopOpacity="0.35" />
            <stop offset="100%" stopColor="transparent"  />
          </linearGradient>

          {/* Bloom filter */}
          <filter id="bhFgBloom" x="-40%" y="-600%" width="180%" height="1300%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Soft filter for contour lines */}
          <filter id="bhContourBlur" x="-10%" y="-200%" width="120%" height="500%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* ════════════════════════════════════════════════════════════════════
            MAIN ACCRETION WAVE (4 stacked layers for volume + sharpness)
        ════════════════════════════════════════════════════════════════════ */}

        {/* 1. Widest blurred envelope — broad orange atmospheric glow */}
        <line
          x1="0" y1={CY} x2={W} y2={CY}
          stroke="url(#bhFgWaveGrad)"
          strokeWidth="80"
          style={{
            filter: 'blur(30px)',
            opacity: 0.80,
            animation: 'bh-band-pulse 7s ease-in-out infinite',
          }}
        />

        {/* 2. Bright mid band — the main visible disk body */}
        <line
          x1="0" y1={CY} x2={W} y2={CY}
          stroke="url(#bhFgWaveGrad)"
          strokeWidth="26"
          style={{
            filter: 'url(#bhFgBloom)',
            opacity: 0.95,
            animation: 'bh-band-mid 5s ease-in-out infinite',
          }}
        />

        {/* 3. Hot luminous spine — sharp bright centerline */}
        <line
          x1="0" y1={CY} x2={W} y2={CY}
          stroke="url(#bhFgHotGrad)"
          strokeWidth="6"
          style={{
            opacity: 0.98,
            animation: 'bh-band-core 4s ease-in-out infinite',
            animationDelay: '0.6s',
          }}
        />

        {/* 4. Center burst — concentrated glow at the event horizon intersection */}
        {/* This creates the "wave piercing the dark core" effect */}
        <ellipse
          cx={W / 2} cy={CY} rx="150" ry="12"
          fill={t.waveCore}
          style={{ filter: 'blur(12px)', opacity: 0.70 }}
        />
        <ellipse
          cx={W / 2} cy={CY} rx="80" ry="6"
          fill={t.waveHot}
          style={{ filter: 'blur(6px)', opacity: 0.80 }}
        />

        {/* ════════════════════════════════════════════════════════════════════
            NEAR-SIDE LENSING ARCS (below the equator — front face of disk)
        ════════════════════════════════════════════════════════════════════ */}

        <path
          d={`M 130 ${CY} C 215 385, 590 385, 670 ${CY}`}
          fill="none"
          stroke="url(#bhFgWaveGrad)"
          strokeWidth="20"
          style={{
            filter: 'url(#bhFgBloom)',
            opacity: 0.82,
            animation: 'bh-arc-bot 10s ease-in-out infinite',
          }}
        />

        <path
          d={`M 90 ${CY} C 215 440, 590 440, 710 ${CY}`}
          fill="none"
          stroke="url(#bhFgWaveGrad)"
          strokeWidth="9"
          style={{
            opacity: 0.40,
            filter: 'blur(7px)',
            animation: 'bh-arc-bot2 14s ease-in-out infinite',
            animationDelay: '1.1s',
          }}
        />

        {/* ════════════════════════════════════════════════════════════════════
            LENSING CONTOUR LINES — gravitational distortion curves above core
        ════════════════════════════════════════════════════════════════════ */}
        {[
          { d: `M 208 ${CY} C 278 ${CY-80}, 525 ${CY-80}, 592 ${CY}`,  sw: 1.0, op: 0.58 },
          { d: `M 228 ${CY} C 295 ${CY-100}, 508 ${CY-100}, 572 ${CY}`, sw: 0.8, op: 0.42 },
          { d: `M 248 ${CY} C 312 ${CY-118}, 492 ${CY-118}, 552 ${CY}`, sw: 0.6, op: 0.30 },
          { d: `M 268 ${CY} C 328 ${CY-134}, 476 ${CY-134}, 532 ${CY}`, sw: 0.5, op: 0.20 },
          { d: `M 288 ${CY} C 344 ${CY-148}, 460 ${CY-148}, 512 ${CY}`, sw: 0.4, op: 0.13 },
        ].map(({ d, sw, op }, i) => (
          <path
            key={`cl-${i}`}
            d={d}
            fill="none"
            stroke={t.contour}
            strokeWidth={sw}
            style={{ filter: 'url(#bhContourBlur)', opacity: op }}
          />
        ))}

        {/* ════════════════════════════════════════════════════════════════════
            ORBITING MATTER PARTICLES
        ════════════════════════════════════════════════════════════════════ */}
        {[
          { cx: 175, cy: CY, fill: '#ffe055', anim: 'bh-p0', dur: '3.2s', delay: '0s'   },
          { cx: 625, cy: CY, fill: '#ffe055', anim: 'bh-p1', dur: '4.0s', delay: '0.5s' },
          { cx:  90, cy: CY, fill: '#ffaa30', anim: 'bh-p2', dur: '5.2s', delay: '1.0s' },
          { cx: 710, cy: CY, fill: '#ffaa30', anim: 'bh-p3', dur: '4.7s', delay: '1.5s' },
          { cx: 250, cy: CY, fill: '#ffcc44', anim: 'bh-p4', dur: '3.6s', delay: '0.3s' },
          { cx: 550, cy: CY, fill: '#ffcc44', anim: 'bh-p5', dur: '3.9s', delay: '0.8s' },
          { cx: 340, cy: CY, fill: '#ff8820', anim: 'bh-p6', dur: '4.4s', delay: '1.2s' },
          { cx: 460, cy: CY, fill: '#ff8820', anim: 'bh-p7', dur: '4.2s', delay: '0.6s' },
        ].map(({ cx, cy, fill, anim, dur, delay }, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={2.8}
            fill={fill}
            style={{
              filter: 'blur(1.5px)',
              animation: `${anim} ${dur} ease-in-out infinite`,
              animationDelay: delay,
            }}
          />
        ))}

        {/* ════════════════════════════════════════════════════════════════════
            HEAT SHIMMER STREAKS
        ════════════════════════════════════════════════════════════════════ */}
        {[
          { x1: 112, x2: 158, stroke: '#ffd040', anim: 'bh-sh0', dur: '1.8s', delay: '0s'   },
          { x1: 245, x2: 292, stroke: '#ff9030', anim: 'bh-sh1', dur: '2.3s', delay: '0.7s' },
          { x1: 370, x2: 430, stroke: '#ffd040', anim: 'bh-sh2', dur: '2.0s', delay: '0.4s' },
          { x1: 505, x2: 555, stroke: '#ff9030', anim: 'bh-sh3', dur: '2.5s', delay: '1.1s' },
          { x1: 638, x2: 688, stroke: '#ffd040', anim: 'bh-sh4', dur: '1.9s', delay: '0.8s' },
        ].map(({ x1, x2, stroke, anim, dur, delay }, i) => (
          <line
            key={`sh-${i}`}
            x1={x1} y1={CY}
            x2={x2} y2={CY}
            stroke={stroke}
            strokeWidth={2}
            style={{
              animation: `${anim} ${dur} ease-in-out infinite`,
              animationDelay: delay,
            }}
          />
        ))}
      </svg>
    </motion.div>
  );
};
