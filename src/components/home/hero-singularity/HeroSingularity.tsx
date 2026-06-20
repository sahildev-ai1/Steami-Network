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
 * Sizing — FULLY DYNAMIC (v2):
 *   A ResizeObserver watches the wrapper div and passes the live
 *   containerWidth to InteractiveSingularity so every breakpoint
 *   (iPhone SE, Galaxy Tab A, iPad, desktop) renders correctly without
 *   any hardcoded pixel floors.
 *
 * Behavior (wave emission, text fluctuation) lives in
 * HeroElementDistortionProvider — NOT touched here.
 */
import React, { useRef, useState, useEffect } from 'react';
import { InteractiveSingularity } from './InteractiveSingularity';

export const HeroSingularity = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!wrapperRef.current) return;
    // Seed immediately so first paint is correct
    setContainerWidth(wrapperRef.current.clientWidth);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center justify-center w-full"
      style={{
        height: '100%',
        minHeight: 'clamp(220px, 40svh, 760px)',
        maxHeight: '760px',
      }}
    >
      <InteractiveSingularity containerWidth={containerWidth} />
    </div>
  );
};
