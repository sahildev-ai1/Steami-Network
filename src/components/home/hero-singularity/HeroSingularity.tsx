/**
 * HeroSingularity — assembles all singularity visual layers.
 *
 * Layer order (z-index):
 *   0  – Warm ambient corona glow (blurred radial, behind everything)
 *   1  – AccretionDiskBackground  (dark shadow masses + far-side lensing arcs)
 *   6  – WaveField                (expanding distortion ripple rings)
 *  10  – EventHorizon             (dark core with amber/cyan rim)
 *  15  – AccretionDiskForeground  (main wave band + near arcs + particles)
 *
 * Sizing:
 *   Mobile portrait  : 300px fixed height
 *   Mobile landscape : 240px fixed height (stops the canvas eating the full screen)
 *   Desktop          : 100% of parent, min 400px, max 760px
 *
 * Behavior (wave emission, text fluctuation) lives in
 * HeroElementDistortionProvider — NOT touched here.
 */
import React from 'react';

import { InteractiveSingularity } from './InteractiveSingularity';

export const HeroSingularity = () => {
  return (
    <div
      className="relative flex items-center justify-center w-full"
      style={{
        // Portrait mobile  → 300 px tall
        // Landscape mobile → 240 px tall  (key fix: was 400px min, so it filled the screen)
        // ≥ lg breakpoint  → inherit parent height, capped at 760 px
        height: '100%',
        minHeight: 'clamp(240px, 40svh, 760px)',
        maxHeight: '760px',
      }}
    >
      <InteractiveSingularity />
    </div>
  );
};
