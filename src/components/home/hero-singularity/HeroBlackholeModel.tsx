import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme-store';
import { HeroBlackholeRingOverlay } from './HeroBlackholeRingOverlay';

// Lazy-load the heavy Three.js scene — it won't be *fetched* until this
// component actually mounts AND useShouldLoad3D() flips to true (see below).
const Singularity3D = lazy(() =>
  import('./Singularity3D').then((m) => ({ default: m.Singularity3D }))
);

/**
 * PERFORMANCE FIX (Lighthouse: LCP 7.7s, TBT 9.88s):
 * Singularity3D pulls in the "vendor-three" chunk (@react-three/fiber +
 * three, ~172KB) plus a GLTF model — and this hero sits above the fold.
 * React.lazy() alone doesn't help here: the dynamic import still fires the
 * instant this component renders for the first time, i.e. during the
 * critical initial paint, competing with the actual LCP element (the hero
 * heading/CTA) for both network and main-thread time.
 *
 * Fix: don't even attempt the dynamic import until the browser reports
 * it's idle (requestIdleCallback, with a setTimeout fallback for Safari),
 * and skip it entirely for prefers-reduced-motion or Save-Data users — the
 * CSS ring overlay rendered below is a complete visual on its own and
 * needs no JS or WebGL.
 */
function useShouldLoad3D() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as any).connection?.saveData === true;
    if (reducedMotion || saveData) return; // never load — the CSS ring overlay is enough

    const ric: (cb: () => void, opts?: { timeout: number }) => number =
      (window as any).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1) as unknown as number);
    const cic: (id: number) => void =
      (window as any).cancelIdleCallback ?? window.clearTimeout;

    const id = ric(() => setShouldLoad(true), { timeout: 2000 });
    return () => cic(id);
  }, []);

  return shouldLoad;
}

export const HeroBlackholeModel = () => {
  const isLight = useThemeStore((s) => s.theme === 'light');
  const shouldLoad3D = useShouldLoad3D();

  return (
    <div
      className="hero-blackhole-model-shell blackhole-edge-mask absolute flex items-center justify-center pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
        /*
         * BUG FIX — Dynamic shell size:
         * Previously no width/height was set here, so the shell collapsed
         * to 0×0 on iPhones and Galaxy Tab A (the 3D canvas had nothing
         * to fill). Now it mirrors the accretion ring clamp so the Three.js
         * canvas always has a proper bounding box:
         *   iPhone SE  (375 px) → ~315 px
         *   Galaxy Tab A (768 px) → ~461 px
         *   Desktop (1440 px)   → 750 px (max)
         */
        width:  'clamp(min(90vw, 300px), 60vw, 750px)',
        height: 'clamp(min(90vw, 300px), 60vw, 750px)',
      }}
    >
      <HeroBlackholeRingOverlay />

      {/* Suspense fallback shown while Three.js + GLTF assets load.
          It also doubles as the permanent visual for reduced-motion /
          save-data users, since Singularity3D never mounts for them. */}
      <Suspense
        fallback={
          <div
            className={`w-full h-full rounded-full blur-2xl animate-pulse ${
              isLight ? 'bg-orange-500/20' : 'bg-orange-600/30'
            }`}
          />
        }
      >
        {shouldLoad3D && (
          <div className="relative z-[3] w-full h-full flex items-center justify-center">
            <Singularity3D />
          </div>
        )}
      </Suspense>
    </div>
  );
};
