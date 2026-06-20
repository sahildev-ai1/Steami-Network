/**
 * WaveField — visual redesign (fiery amber/orange theme)
 * ───────────────────────────────────────────────────────
 * Behavior logic is UNCHANGED (waveCount, isEmitting, 5s interval).
 * Only the ring colors and glow styles are updated to match the
 * Interstellar fiery accretion reference.
 *
 * Each emission fires THREE concentric rings:
 *  1. Primary — warm amber glow, 2px border
 *  2. Secondary — muted orange-red, 1.5px, slightly delayed
 *  3. Echo — faint gold whisper, 1px, most delayed
 *
 * They expand scale 0.08 → 3.2 while fading, reaching all hero corners.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useSingularity } from './HeroElementDistortionProvider';
import { useThemeStore } from '@/stores/theme-store';

export const WaveField = () => {
  const { waveCount, isEmitting } = useSingularity();
  const isLight = useThemeStore((s) => s.theme === 'light');

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        /* BUG FIX: min was 260px which on a 375px iPhone leaves only
           115px of margin — and when paired with the ring overlay it
           caused horizontal overflow. Now min scales with viewport. */
        width:  'clamp(min(70vw, 260px), 34vw, 420px)',
        height: 'clamp(min(26vw, 160px), 20vw, 240px)',
        zIndex: 6,
        overflow: 'visible',
      }}
    >
      <AnimatePresence>
        {isEmitting && (
          <motion.div
            key={waveCount}
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ overflow: 'visible' }}
          >
            {/* ── Primary intelligence ripple — amber/orange ── */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                border: isLight
                  ? '2px solid rgba(255, 155, 40, 0.38)'
                  : '2px solid rgba(255, 165, 50, 0.34)',
                boxShadow: isLight
                  ? '0 0 28px 5px rgba(255,140,20,0.16), inset 0 0 18px rgba(255,120,0,0.08)'
                  : '0 0 30px 6px rgba(255,150,30,0.18), inset 0 0 20px rgba(255,100,0,0.10)',
                overflow: 'visible',
              }}
              initial={{ scale: 0.08, opacity: 1 }}
              animate={{ scale: 3.2, opacity: 0 }}
              transition={{ duration: 2.8, ease: [0.1, 0.4, 0.6, 1] }}
            />

            {/* ── Secondary ripple — deeper orange-red ── */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                border: isLight
                  ? '1.5px solid rgba(230, 100, 20, 0.28)'
                  : '1.5px solid rgba(240, 110, 25, 0.24)',
                boxShadow: isLight
                  ? '0 0 16px 3px rgba(220,80,10,0.10)'
                  : '0 0 18px 4px rgba(220,90,15,0.12)',
                overflow: 'visible',
              }}
              initial={{ scale: 0.08, opacity: 0.82 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{ duration: 2.5, delay: 0.28, ease: [0.1, 0.4, 0.6, 1] }}
            />

            {/* ── Echo ripple — faint gold whisper ── */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                border: isLight
                  ? '1px solid rgba(255, 195, 60, 0.18)'
                  : '1px solid rgba(255, 210, 70, 0.15)',
                overflow: 'visible',
              }}
              initial={{ scale: 0.08, opacity: 0.58 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 2.2, delay: 0.55, ease: [0.1, 0.4, 0.6, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
