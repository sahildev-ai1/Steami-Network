import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme-store';
import { HeroBlackholeRingOverlay } from './HeroBlackholeRingOverlay';

// Lazy-load the heavy Three.js scene — it won't be fetched until this
// component actually mounts.
const Singularity3D = lazy(() =>
  import('./Singularity3D').then((m) => ({ default: m.Singularity3D }))
);

/**
 * Defers mounting the Three.js scene by a short, bounded idle window
 * (≤500ms) so the dynamic import + WebGL init don't compete with the very
 * first paint. It always eventually loads — this is the homepage's primary
 * visual, so it's a brief delay, never a permanent skip.
 *
 * REGRESSION FIX: the previous version pulled window.requestIdleCallback /
 * cancelIdleCallback / setTimeout / clearTimeout off `window` into bare
 * variables (`const ric = window.requestIdleCallback ?? ...`) and called
 * them detached — `ric(fn)` instead of `window.requestIdleCallback(fn)`.
 * These specific browser APIs require being invoked with `window` as the
 * receiver; called without it, they throw "TypeError: Illegal invocation".
 * That was firing inside useEffect on every mount, and React's nearest
 * error boundary caught it — unmounting the entire hero visual (ring
 * overlay, particles, core, everything), even though none of that other
 * code was actually broken. Calling them as window.method(...) directly,
 * with no intermediate variable, keeps the correct receiver.
 */
function useDeferredMount(maxDelayMs = 500) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => setReady(true), { timeout: maxDelayMs });
    } else {
      // Safari has no requestIdleCallback — short timeout fallback.
      timeoutId = window.setTimeout(() => setReady(true), 1) as unknown as number;
    }

    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [maxDelayMs]);

  return ready;
}

export const HeroBlackholeModel = () => {
  const isLight = useThemeStore((s) => s.theme === 'light');
  const ready = useDeferredMount();

  const placeholder = (
    <div
      className={`w-full h-full rounded-full blur-2xl animate-pulse ${
        isLight ? 'bg-orange-500/20' : 'bg-orange-600/30'
      }`}
    />
  );

  return (
    <div
      className="hero-blackhole-model-shell blackhole-edge-mask absolute flex items-center justify-center pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
        /*
         * Dynamic shell size — mirrors the accretion ring clamp so the
         * Three.js canvas always has a proper bounding box:
         *   iPhone SE  (375 px) → ~315 px
         *   Galaxy Tab A (768 px) → ~461 px
         *   Desktop (1440 px)   → 750 px (max)
         */
        width:  'clamp(min(90vw, 300px), 60vw, 750px)',
        height: 'clamp(min(90vw, 300px), 60vw, 750px)',
      }}
    >
      <HeroBlackholeRingOverlay />

      {/* Suspense fallback covers the chunk-loading gap; the same
          placeholder also covers the brief pre-`ready` defer window, so
          something is always visible — no blank gap either way. */}
      <Suspense fallback={placeholder}>
        {ready ? (
          <div className="relative z-[3] w-full h-full flex items-center justify-center">
            <Singularity3D />
          </div>
        ) : (
          placeholder
        )}
      </Suspense>
    </div>
  );
};
