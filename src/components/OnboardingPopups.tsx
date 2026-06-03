/**
 * OnboardingPopups.tsx — STEAMI v3
 * ─────────────────────────────────────────────────────────────────────────────
 * 4-stage onboarding popup system for unauthenticated STEAMI visitors.
 *
 * Timing:
 *   Popup 1 → shown after 25s on site (first visit)
 *   Popup 2 → shown 18s after popup 1 is closed (without signing up)
 *   Popup 3 → shown 18s after popup 2 is closed
 *   Popup 4 → shown 18s after popup 3 is closed
 *             "Continue Exploring" button runs away from cursor for 15s on
 *             desktop; on mobile it shakes for 15s before popup can close.
 *
 * Fixes applied (v3):
 *   - Light-mode theming via CSS variables / prefers-color-scheme
 *   - Register → abandon no longer kills the popup sequence
 *   - Popup loop restarts correctly on page refresh (done only on sign-up)
 *   - RunawayButton rendered in a fixed portal so it escapes the popup bounds
 *   - Scrollbar removed from modal (no overflow scroll)
 *   - Richer animations: particles, staggered entry, pulse rings, shimmer
 *
 * Debug: window.__resetSteamiPopups?.()
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AuthModal } from '@/components/AuthModal';

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SK_PHASE      = 'steami_ob_phase';
const SK_LAST_CLOSE = 'steami_ob_lclose';
const SK_DONE       = 'steami_ob_done';   // only set when user actually signs up
const SK_SESSION    = 'steami_ob_session'; // sessionStorage flag — lives per tab/refresh

// ─── Session-aware reset ──────────────────────────────────────────────────────
// sessionStorage is wiped on every new tab and every page refresh, while
// localStorage persists. On a fresh session we clear phase & lastClose so the
// 25-second timer always starts from zero — even if the user left mid-sequence.
// SK_DONE (signed-up flag) is intentionally never cleared here.
if (typeof window !== 'undefined' && !ssGet(SK_SESSION)) {
  lsRemove(SK_PHASE);
  lsRemove(SK_LAST_CLOSE);
  ssSet(SK_SESSION, '1');
}

// Safe wrappers — localStorage can throw in incognito/private mode
function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch {}
}
function lsRemove(k: string) {
  try { localStorage.removeItem(k); } catch {}
}
function ssGet(k: string): string | null {
  try { return sessionStorage.getItem(k); } catch { return null; }
}
function ssSet(k: string, v: string) {
  try { sessionStorage.setItem(k, v); } catch {}
}
function ssRemove(k: string) {
  try { sessionStorage.removeItem(k); } catch {}
}

function getPhase(): number     { return parseInt(lsGet(SK_PHASE) ?? '0', 10); }
function setPhase(n: number)    { lsSet(SK_PHASE, String(n)); }
function getLastClose(): number { return parseInt(lsGet(SK_LAST_CLOSE) ?? '0', 10); }
function setLastClose()         { lsSet(SK_LAST_CLOSE, String(Date.now())); }
function markDone()             { lsSet(SK_DONE, '1'); }
function clearDone()            { lsRemove(SK_DONE); }
function isDone(): boolean      { return lsGet(SK_DONE) === '1'; }

if (typeof window !== 'undefined') {
  (window as any).__resetSteamiPopups = () => {
    [SK_PHASE, SK_LAST_CLOSE, SK_DONE].forEach(lsRemove);
    ssRemove(SK_SESSION);
    console.log('[STEAMI] Popup state cleared. Reload to restart.');
  };
}

// ─── Theme detection ──────────────────────────────────────────────────────────
// Reads `data-theme` attribute set by theme-store.ts (values: "dark" | "light")
function readDataTheme(): boolean {
  if (typeof document === 'undefined') return false;
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark')  return true;
  if (attr === 'light') return false;
  // Fallback: OS preference if attribute not yet set
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function useTheme() {
  const [isDark, setIsDark] = useState(readDataTheme);

  useEffect(() => {
    // Watch data-theme attribute changes (toggled by useThemeStore)
    const observer = new MutationObserver(() => setIsDark(readDataTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Fallback: OS preference when no attribute is set
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const mqHandler = () => {
      if (!document.documentElement.hasAttribute('data-theme')) setIsDark(mq.matches);
    };
    mq.addEventListener('change', mqHandler);

    return () => { observer.disconnect(); mq.removeEventListener('change', mqHandler); };
  }, []);

  return isDark;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
interface ThemeTokens {
  bg: string;
  bgInner: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  card: string;
  cardBorder: string;
  closeBg: string;
  closeBgHover: string;
  closeColor: string;
  shadow: string;
  backdropBg: string;
  secBtn: string;
  secBtnHover: string;
  secBtnColor: string;
  secBtnBorder: string;
}

function getTokens(isDark: boolean): ThemeTokens {
  if (isDark) return {
    bg:            'rgba(8,12,30,0.96)',
    bgInner:       'rgba(255,255,255,0.03)',
    border:        'rgba(255,255,255,0.1)',
    text:          '#ffffff',
    textMuted:     'rgba(255,255,255,0.6)',
    textFaint:     'rgba(255,255,255,0.4)',
    card:          'rgba(255,255,255,0.04)',
    cardBorder:    'rgba(255,255,255,0.08)',
    closeBg:       'rgba(255,255,255,0.06)',
    closeBgHover:  'rgba(255,255,255,0.14)',
    closeColor:    'rgba(255,255,255,0.55)',
    shadow:        '0 8px 60px rgba(0,0,0,0.65)',
    backdropBg:    'rgba(0,0,0,0.75)',
    secBtn:        'rgba(255,255,255,0.07)',
    secBtnHover:   'rgba(255,255,255,0.13)',
    secBtnColor:   'rgba(255,255,255,0.75)',
    secBtnBorder:  'rgba(255,255,255,0.13)',
  };
  return {
    bg:            'rgba(255,255,255,0.97)',
    bgInner:       'rgba(0,0,0,0.025)',
    border:        'rgba(0,0,0,0.1)',
    text:          '#0f172a',
    textMuted:     'rgba(15,23,42,0.65)',
    textFaint:     'rgba(15,23,42,0.4)',
    card:          'rgba(0,0,0,0.03)',
    cardBorder:    'rgba(0,0,0,0.08)',
    closeBg:       'rgba(0,0,0,0.06)',
    closeBgHover:  'rgba(0,0,0,0.12)',
    closeColor:    'rgba(0,0,0,0.5)',
    shadow:        '0 8px 60px rgba(0,0,0,0.18)',
    backdropBg:    'rgba(15,23,42,0.55)',
    secBtn:        'rgba(0,0,0,0.05)',
    secBtnHover:   'rgba(0,0,0,0.1)',
    secBtnColor:   'rgba(15,23,42,0.7)',
    secBtnBorder:  'rgba(0,0,0,0.1)',
  };
}

// ─── Floating particles ─ dots + sparkle stars + drift ───────────────────────
function Particles({ color }: { color: string }) {
  // Fewer particles on mobile for performance
  const isMobileParticles = typeof window !== 'undefined' && window.innerWidth < 600;
  // Stable particle config — generated once per mount
  const dots = useMemo(() => Array.from({ length: isMobileParticles ? 6 : 16 }, (_, i) => ({
    id: i,
    x: 5 + (i * 23.7 + 11) % 90,
    y: 5 + (i * 17.3 + 7) % 90,
    size: 1.5 + (i % 4) * 1.2,
    delay: (i * 0.37) % 4,
    dur: 3.5 + (i % 5) * 0.8,
    shape: i % 4 === 0 ? 'star' : 'dot',
  })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 24 }}>
      {dots.map(p => (
        p.shape === 'star' ? (
          <motion.div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`, top: `${p.y}%`,
              fontSize: p.size * 4,
              color,
              opacity: 0,
              lineHeight: 1,
            }}
            animate={{
              opacity: [0, 0.9, 0.4, 0.9, 0],
              scale: [0.4, 1.3, 0.8, 1.2, 0.4],
              rotate: [0, 180, 360],
            }}
            transition={{ duration: p.dur + 1, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          >✦</motion.div>
        ) : (
          <motion.div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`, top: `${p.y}%`,
              width: p.size, height: p.size,
              borderRadius: '50%',
              background: color,
              opacity: 0,
            }}
            animate={{
              opacity: [0, 0.8, 0.2, 0.7, 0],
              y: [0, -(20 + p.size * 8), -(40 + p.size * 12)],
              x: [0, (p.id % 2 === 0 ? 1 : -1) * p.size * 3, 0],
              scale: [0.3, 1.1, 0.5],
            }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
          />
        )
      ))}
    </div>
  );
}

// ─── Orbit ring — rotates around the card ────────────────────────────────────
function OrbitRing({ color }: { color: string }) {
  return (
    <motion.div
      style={{
        position: 'absolute', inset: -3,
        borderRadius: 27,
        border: `1px solid ${color}`,
        opacity: 0,
        pointerEvents: 'none',
      }}
      animate={{
        opacity: [0, 0.35, 0.1, 0.35, 0],
        scale: [0.98, 1.005, 0.98],
      }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// ─── Animated gradient backdrop mesh ─────────────────────────────────────────
function BackdropMesh({ color }: { color: string }) {
  return (
    <>
      <motion.div
        style={{
          position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
          background: `radial-gradient(ellipse 60% 50% at 20% 30%, ${color}18 0%, transparent 70%)`,
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
          background: `radial-gradient(ellipse 55% 45% at 80% 70%, ${color}12 0%, transparent 70%)`,
        }}
        animate={{ opacity: [1, 0.5, 1], scale: [1.04, 1, 1.04] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </>
  );
}

// ─── Pulse rings (two staggered) ─────────────────────────────────────────────
function PulseRing({ color }: { color: string }) {
  return (
    <>
      <motion.div
        style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${color}`, opacity: 0 }}
        animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
        transition={{ duration: 1.9, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.div
        style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1px solid ${color}`, opacity: 0 }}
        animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
        transition={{ duration: 1.9, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
      />
    </>
  );
}

// ─── 3-D Mascot ───────────────────────────────────────────────────────────────
interface MascotProps {
  color: 'cyan' | 'amber' | 'purple' | 'blue';
  expression: 'wink' | 'curious' | 'surprised' | 'sad';
}

function Mascot({ color, expression }: MascotProps) {
  const palettes = {
    cyan:   { body: '#0ff',    glow: '#00d9ff', face: '#00a8c8', shine: '#80ffff' },
    amber:  { body: '#fbbf24', glow: '#f59e0b', face: '#d97706', shine: '#fde68a' },
    purple: { body: '#a78bfa', glow: '#7c3aed', face: '#6d28d9', shine: '#ddd6fe' },
    blue:   { body: '#60a5fa', glow: '#2563eb', face: '#1d4ed8', shine: '#bfdbfe' },
  };
  const p = palettes[color];

  const expressions: Record<string, JSX.Element> = {
    wink: (
      <g>
        <ellipse cx="38" cy="48" rx="7" ry="8" fill="#0a0a1a" />
        <ellipse cx="40" cy="46" rx="2.5" ry="2.5" fill="white" opacity="0.85" />
        <path d="M55 49 Q62 44 69 49" stroke="#0a0a1a" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M40 62 Q53 72 66 62" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="32" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.35" />
        <ellipse cx="74" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.35" />
      </g>
    ),
    curious: (
      <g>
        <ellipse cx="38" cy="47" rx="8" ry="9" fill="#0a0a1a" />
        <ellipse cx="40" cy="45" rx="3" ry="3" fill="white" opacity="0.85" />
        <ellipse cx="68" cy="47" rx="8" ry="9" fill="#0a0a1a" />
        <ellipse cx="70" cy="45" rx="3" ry="3" fill="white" opacity="0.85" />
        <ellipse cx="53" cy="66" rx="8" ry="5" fill="#0a0a1a" opacity="0.8" />
        <ellipse cx="28" cy="60" rx="7" ry="4" fill="#ff6b9d" opacity="0.3" />
        <ellipse cx="78" cy="60" rx="7" ry="4" fill="#ff6b9d" opacity="0.3" />
      </g>
    ),
    surprised: (
      <g>
        <ellipse cx="37" cy="46" rx="9" ry="10" fill="#0a0a1a" />
        <ellipse cx="39" cy="43" rx="3.5" ry="3.5" fill="white" opacity="0.85" />
        <ellipse cx="69" cy="46" rx="9" ry="10" fill="#0a0a1a" />
        <ellipse cx="71" cy="43" rx="3.5" ry="3.5" fill="white" opacity="0.85" />
        <text x="33" y="50" fontSize="6" fill="white" opacity="0.6">✦</text>
        <text x="65" y="50" fontSize="6" fill="white" opacity="0.6">✦</text>
        <ellipse cx="53" cy="67" rx="10" ry="7" fill="#0a0a1a" opacity="0.85" />
        <path d="M44 67 Q53 74 62 67" fill="#ff4466" opacity="0.7" />
        <ellipse cx="26" cy="58" rx="8" ry="5" fill="#ff6b9d" opacity="0.4" />
        <ellipse cx="80" cy="58" rx="8" ry="5" fill="#ff6b9d" opacity="0.4" />
      </g>
    ),
    sad: (
      <g>
        <ellipse cx="38" cy="49" rx="7" ry="8" fill="#0a0a1a" />
        <ellipse cx="40" cy="47" rx="2.5" ry="2.5" fill="white" opacity="0.85" />
        <ellipse cx="68" cy="49" rx="7" ry="8" fill="#0a0a1a" />
        <ellipse cx="70" cy="47" rx="2.5" ry="2.5" fill="white" opacity="0.85" />
        <path d="M30 38 Q38 35 43 39" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M63 39 Q68 35 76 38" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M42 66 Q53 59 64 66" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="70" cy="60" rx="3" ry="4" fill="#60a5fa" opacity="0.7" />
        <path d="M70 64 Q67 70 70 73 Q73 70 70 64" fill="#60a5fa" opacity="0.7" />
        <ellipse cx="28" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.25" />
        <ellipse cx="78" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.25" />
      </g>
    ),
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <PulseRing color={p.glow} />
      <motion.div
        animate={{
          y: [0, -10, 0, -6, 0, -10, 0],
          rotate: expression === 'curious' ? [-3, 3, -3] : expression === 'sad' ? [-2, -2, 0, -2] : [-1, 1, -1],
        }}
        transition={{ duration: expression === 'sad' ? 5 : 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: `drop-shadow(0 0 32px ${p.glow}88)` }}
      >
        <svg width="140" height="140" viewBox="0 0 106 106" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`bodyGrad-${color}`} cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor={p.shine} stopOpacity="0.9" />
              <stop offset="45%" stopColor={p.body} />
              <stop offset="100%" stopColor={p.face} />
            </radialGradient>
            <radialGradient id={`rimGrad-${color}`} cx="85%" cy="85%" r="40%">
              <stop offset="0%" stopColor={p.shine} stopOpacity="0.5" />
              <stop offset="100%" stopColor={p.body} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="53" cy="96" rx="34" ry="8" fill={p.body} opacity="0.15" />
          <ellipse cx="53" cy="96" rx="22" ry="5" fill={p.glow} opacity="0.25" />
          <circle cx="53" cy="52" r="44" fill={`url(#bodyGrad-${color})`} />
          <circle cx="53" cy="52" r="44" fill={`url(#rimGrad-${color})`} />
          <ellipse cx="42" cy="30" rx="16" ry="10" fill="white" opacity="0.22" />
          <ellipse cx="38" cy="26" rx="8" ry="5" fill="white" opacity="0.35" />
          <circle cx="53" cy="52" r="44" fill="none" stroke={p.shine} strokeWidth="0.5" opacity="0.4" />
          {expressions[expression]}
          <ellipse cx="14" cy="70" rx="10" ry="8" fill={p.body} />
          <ellipse cx="14" cy="70" rx="10" ry="8" fill={`url(#rimGrad-${color})`} />
          <ellipse cx="10" cy="67" rx="3.5" ry="3" fill={p.shine} opacity="0.5" />
          <ellipse cx="93" cy="70" rx="10" ry="8" fill={p.body} />
          <ellipse cx="93" cy="70" rx="10" ry="8" fill={`url(#rimGrad-${color})`} />
          <ellipse cx="97" cy="67" rx="3.5" ry="3" fill={p.shine} opacity="0.5" />
          {/* Blink overlay — covers eyes briefly */}
          <motion.rect
            x="26" y="40" width="54" height="18" rx="9"
            fill={p.body}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.88, 0.9, 0.96, 1, 1, 1, 1, 1, 1] }}
            style={{ transformOrigin: '53px 49px' }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
function SpeechBubble({ text, color, isDark }: { text: string; color: string; isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.75, y: 12 }}
      animate={{ opacity: 1, scale: [1, 1.03, 1], y: [0, -3, 0] }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 280, damping: 18 }}
      style={{
        background: `${color}${isDark ? '18' : '12'}`,
        border: `1px solid ${color}40`,
        borderRadius: 16,
        padding: '10px 16px',
        marginTop: 12,
        position: 'relative',
        maxWidth: 220,
        textAlign: 'center',
      }}
    >
      <div style={{
        position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '9px solid transparent',
        borderRight: '9px solid transparent',
        borderBottom: `9px solid ${color}40`,
      }} />
      <p style={{ color, fontSize: 13, margin: 0, fontStyle: 'italic' }}>{text}</p>
    </motion.div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
interface ShellProps {
  onClose: () => void;
  children: React.ReactNode;
  glowColor: string;
  isDark: boolean;
  showClose?: boolean;
  tokens: ThemeTokens;
  extraBg?: React.ReactNode;
  activeIndex?: number; // 1-based which popup is showing
}

function ModalShell({ onClose, children, glowColor, isDark, showClose = true, tokens, extraBg, activeIndex = 1 }: ShellProps) {
  return (
    <>
      {/* Backdrop with animated mesh */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          // Also extend behind browser chrome with -webkit-fill-available fallback
          height: '100%',
          minHeight: '-webkit-fill-available',
          zIndex: 9000,
          background: tokens.backdropBg,
          backdropFilter: 'blur(12px)',
        }}
      >
        <BackdropMesh color={glowColor} />
      </motion.div>
      {/* Card wrapper — no overflow so RunawayButton can portal outside */}
      <motion.div
        initial={{ opacity: 0, scale: 0.82, y: 56, rotateX: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.86, y: 32, rotateX: -6 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          // Use dvh so the popup avoids browser chrome on mobile Firefox/Safari
          top: 0, left: 0, right: 0,
          height: '100dvh',
          zIndex: 9001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Safe-area insets keep content away from notch/home bar/browser nav
          padding: 'max(env(safe-area-inset-top, 8px), 8px) max(env(safe-area-inset-right, 12px), 12px) max(env(safe-area-inset-bottom, 8px), 8px) max(env(safe-area-inset-left, 12px), 12px)',
          pointerEvents: 'none',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      >
        <div
          className="steami-popup-card"
          onClick={e => e.stopPropagation()}
          style={{
            pointerEvents: 'all',
            position: 'relative',
            width: '100%',
            maxWidth: 860,
            // maxHeight prevents the card taller than the usable viewport on mobile
            maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 16px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            // Hide the scrollbar visually while keeping scrollability
            scrollbarWidth: 'none',
            borderRadius: 24,
            border: `1px solid ${isDark ? `${glowColor}25` : `${glowColor}30`}`,
            background: tokens.bg,
            backdropFilter: typeof window !== 'undefined' && window.innerWidth < 600 ? 'blur(8px)' : 'blur(40px)',
            boxShadow: `0 0 80px ${glowColor}22, ${tokens.shadow}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)'}`,
          } as React.CSSProperties}
        >
          <Particles color={glowColor} />
          <OrbitRing color={glowColor} />
          {extraBg}

          {/* Glow blobs */}
          <div style={{
            position: 'absolute', top: -60, left: -60, width: 200, height: 200,
            borderRadius: '50%', background: `${glowColor}${isDark ? '1a' : '10'}`,
            filter: 'blur(48px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, right: -60, width: 200, height: 200,
            borderRadius: '50%', background: `${glowColor}${isDark ? '12' : '0c'}`,
            filter: 'blur(48px)', pointerEvents: 'none',
          }} />

          {/* Progress dots — active one is larger and solid */}
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 7, alignItems: 'center',
          }}>
            {[1,2,3,4].map(n => {
              const isActive = n === activeIndex;
              const isPast   = n < activeIndex;
              return (
                <motion.div
                  key={n}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isActive
                    ? { scale: [1, 1.3, 1], opacity: 1, width: 20 }
                    : { scale: 1, opacity: isPast ? 0.9 : 0.3, width: 6 }
                  }
                  transition={isActive
                    ? { scale: { duration: 1.6, repeat: Infinity }, width: { duration: 0.3 } }
                    : { duration: 0.3 }
                  }
                  style={{
                    height: 6, borderRadius: 4,
                    background: isActive ? glowColor : (isPast ? glowColor : glowColor),
                    boxShadow: isActive ? `0 0 8px ${glowColor}` : 'none',
                  }}
                />
              );
            })}
          </div>

          {/* Close button */}
          {showClose && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 14, right: 14, zIndex: 10,
                background: tokens.closeBg,
                border: `1px solid ${tokens.border}`,
                borderRadius: '50%',
                width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: tokens.closeColor,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = tokens.closeBgHover;
                b.style.transform = 'rotate(90deg) scale(1.1)';
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = tokens.closeBg;
                b.style.transform = 'rotate(0deg) scale(1)';
              }}
            >
              <X size={15} />
            </button>
          )}

          <div className="steami-popup-inner" style={{ padding: '36px 28px 26px' }}>
            <style>{`.steami-popup-inner { padding: clamp(28px, 4vw, 36px) clamp(16px, 4vw, 28px) clamp(16px, 3vw, 26px) !important; }`}</style>
            {children}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Shared layout ────────────────────────────────────────────────────────────
const containerAnim = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show:   { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 280, damping: 20 } },
};

function PopupLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <motion.div
      variants={containerAnim} initial="hidden" animate="show"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: 24, alignItems: 'center' }}
      className="steami-popup-grid"
    >
      <motion.div
        variants={itemAnim}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}
      >
        {left}
      </motion.div>
      <motion.div variants={itemAnim}>{right}</motion.div>
      <style>{`
        @media (max-width: 600px) {
          .steami-popup-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          /* Reduce mascot size on mobile to save vertical space */
          .steami-popup-grid svg[width="140"] {
            width: 90px !important;
            height: 90px !important;
          }
          /* Tighten speech bubble */
          .steami-popup-grid .steami-speech-bubble {
            margin-top: 6px !important;
            padding: 7px 12px !important;
            font-size: 11px !important;
          }
        }
        /* Hide webkit scrollbar on the card */
        .steami-popup-card::-webkit-scrollbar { display: none; }
        @keyframes ob-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes ob-shake {
          0%,100%{ transform: rotate(0deg) scale(1); }
          20%    { transform: rotate(-6deg) scale(1.05); }
          40%    { transform: rotate(6deg) scale(1.05); }
          60%    { transform: rotate(-4deg) scale(1.02); }
          80%    { transform: rotate(4deg) scale(1.02); }
        }
        @keyframes ob-glow-pulse {
          0%,100%{ box-shadow: 0 0 12px currentColor; }
          50%    { box-shadow: 0 0 32px currentColor, 0 0 60px currentColor; }
        }
        @keyframes ob-float-badge {
          0%,100%{ transform: translateY(0px) rotate(-1deg); }
          50%    { transform: translateY(-4px) rotate(1deg); }
        }
      `}</style>
    </motion.div>
  );
}

// ─── CTA Button — ripple + glow pulse ────────────────────────────────────────
function PrimaryBtn({ onClick, children, gradient }: { onClick: () => void; children: React.ReactNode; gradient: string }) {
  const [ripple, setRipple] = useState<{x:number;y:number;id:number}|null>(null);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() });
    setTimeout(() => setRipple(null), 600);
    onClick();
  };
  return (
    <motion.button
      onClick={handleClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, boxShadow: ['0 4px 20px rgba(0,0,0,0.2)', '0 4px 32px rgba(0,0,0,0.35)', '0 4px 20px rgba(0,0,0,0.2)'] }}
      transition={{ opacity: { delay: 0.6, duration: 0.3 }, boxShadow: { duration: 2, repeat: Infinity } }}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.96 }}
      style={{
        background: gradient,
        border: 'none',
        borderRadius: 14,
        padding: '13px 20px',
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        flex: 1,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {ripple && (
        <motion.span
          key={ripple.id}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 6, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: ripple.x, top: ripple.y,
            width: 20, height: 20,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.4)',
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </motion.button>
  );
}

// ─── Secondary button ─────────────────────────────────────────────────────────
function SecBtn({ onClick, children, tokens }: { onClick: () => void; children: React.ReactNode; tokens: ThemeTokens }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: tokens.secBtn,
        border: `1px solid ${tokens.secBtnBorder}`,
        borderRadius: 14,
        padding: '13px 20px',
        color: tokens.secBtnColor,
        fontSize: 14,
        cursor: 'pointer',
        flex: 1,
        minWidth: 0,
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = tokens.secBtnHover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = tokens.secBtn; }}
    >
      {children}
    </motion.button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ text, color, isDark }: { text: string; color: string; isDark: boolean }) {
  return (
    <motion.span
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: `${color}${isDark ? '18' : '12'}`,
        border: `1px solid ${color}40`,
        borderRadius: 999,
        padding: '4px 12px',
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color,
        marginBottom: 10,
        fontWeight: 700,
      }}
    >
      <motion.span
        animate={{ rotate: [0, 180, 360], scale: [1, 1.3, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      >✦</motion.span>
      {text}
    </motion.span>
  );
}

// ─── CountUp number animation ────────────────────────────────────────────────
function CountUp({ to, delay = 0, color }: { to: number; delay?: number; color: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const start  = Date.now();
      const dur    = 900;
      const tick = () => {
        const t = Math.min((Date.now() - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out-cubic
        setVal(Math.round(ease * to));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [to, delay]);
  return <span style={{ color }}>{val}%</span>;
}

// ─── TearDrop falling animation (Popup 4) ────────────────────────────────────
function TearDrops({ color }: { color: string }) {
  const drops = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    id: i,
    x: 10 + (i * 12.5),
    delay: i * 0.6,
    dur: 2.2 + (i % 3) * 0.5,
    size: 6 + (i % 3) * 3,
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 24 }}>
      {drops.map(d => (
        <motion.div
          key={d.id}
          style={{
            position: 'absolute',
            left: `${d.x}%`, top: -20,
            width: d.size, height: d.size * 1.4,
            borderRadius: `${d.size * 0.5}px ${d.size * 0.5}px ${d.size * 0.5}px 0`,
            background: color,
            opacity: 0,
            transform: 'rotate(45deg)',
          }}
          animate={{ y: ['0vh', '110vh'], opacity: [0, 0.6, 0.6, 0] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

// ─── Knowledge web SVG (Popup 3) ─────────────────────────────────────────────
function KnowledgeWeb({ color }: { color: string }) {
  const nodes = [
    { x: 50, y: 50, label: 'AI' },
    { x: 20, y: 25, label: 'Physics' },
    { x: 80, y: 25, label: 'Bio' },
    { x: 15, y: 70, label: 'Math' },
    { x: 85, y: 70, label: 'Space' },
    { x: 50, y: 88, label: 'Eng' },
  ];
  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[3,5],[4,5],[1,3],[2,4]];
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: 90, display: 'block' }}>
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke={color} strokeWidth="0.5" strokeOpacity="0.4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.6 + i * 0.08, duration: 0.5 }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.g key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 + i * 0.1, type: 'spring', stiffness: 300 }}
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        >
          <motion.circle
            cx={n.x} cy={n.y} r={i === 0 ? 9 : 6}
            fill={color} fillOpacity={i === 0 ? 0.25 : 0.15}
            stroke={color} strokeWidth="0.8" strokeOpacity="0.7"
            animate={{ r: i === 0 ? [9, 10.5, 9] : [6, 7, 6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          />
          <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle"
            fontSize={i === 0 ? 4.5 : 3.5} fill={color} fillOpacity={0.9} fontWeight="bold">
            {n.label}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, tokens, delay = 0 }: { icon: string; title: string; desc: string; tokens: ThemeTokens; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 280, damping: 24 }}
      whileHover={{ scale: 1.02, x: 3 }}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        background: tokens.card,
        border: `1px solid ${tokens.cardBorder}`,
        borderRadius: 12, padding: '9px 13px',
      }}
    >
      <motion.span
        animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 2.5, delay: delay + 0.8, repeat: Infinity, repeatDelay: 3.5 }}
        whileHover={{ scale: 1.35, rotate: 15 }}
        style={{ fontSize: 20, flexShrink: 0, display: 'inline-block' }}
      >{icon}</motion.span>
      <div>
        <p style={{ margin: 0, color: tokens.text, fontSize: 13, fontWeight: 600 }}>{title}</p>
        <p style={{ margin: 0, color: tokens.textMuted, fontSize: 11, marginTop: 2 }}>{desc}</p>
      </div>
    </motion.div>
  );
}

// ─── Runaway button — rendered via portal in fixed coordinates ────────────────
/**
 * The button is rendered into document.body via a React portal so it is
 * completely outside the popup's DOM tree and can move anywhere on screen.
 * On desktop it flees from the cursor. On mobile it shakes on tap.
 */
function RunawayButton({ onClose, lockMs = 15000, glowColor }: { onClose: () => void; lockMs?: number; glowColor: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // null = not positioned yet
  const [locked, setLocked] = useState(true);
  const [countdown, setCountdown] = useState(Math.ceil(lockMs / 1000));
  const [shaking, setShaking] = useState(false);
  const btnRef     = useRef<HTMLButtonElement>(null);
  const posRef     = useRef({ x: 0, y: 0 });
  const lockedRef  = useRef(true);
  const isMobile   = useRef(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  const initialSet = useRef(false);

  // Set initial position once the button mounts and we know its size
  useEffect(() => {
    if (initialSet.current || !btnRef.current) return;
    initialSet.current = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Start centered-bottom of screen
    const bw = 200;
    const bh = 52;
    const ix = (vw - bw) / 2;
    const iy = vh - bh - 40;
    posRef.current = { x: ix, y: iy };
    setPos({ x: ix, y: iy });
  }, []);

  // Countdown
  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          setLocked(false);
          lockedRef.current = false;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Desktop flee
  useEffect(() => {
    if (isMobile.current) return;
    const onMove = (e: MouseEvent) => {
      if (!lockedRef.current || !btnRef.current) return;
      const btn  = btnRef.current;
      const rect = btn.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dx   = e.clientX - cx;
      const dy   = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 140) {
        const angle = Math.atan2(dy, dx);
        const flee  = 90 + (140 - dist) * 1.6;
        const margin = 16;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let nx = posRef.current.x - Math.cos(angle) * flee;
        let ny = posRef.current.y - Math.sin(angle) * flee;
        nx = Math.max(margin, Math.min(vw - rect.width  - margin, nx));
        ny = Math.max(margin, Math.min(vh - rect.height - margin, ny));
        posRef.current = { x: nx, y: ny };
        setPos({ x: nx, y: ny });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const handleTap = () => {
    if (!locked) { onClose(); return; }
    setShaking(true);
    setTimeout(() => setShaking(false), 700);
  };

  // Don't render until position is known
  if (pos === null) {
    return createPortal(
      <button ref={btnRef} style={{ position: 'fixed', opacity: 0, top: 0, left: 0, pointerEvents: 'none' }} />,
      document.body
    );
  }

  const totalSecs = Math.ceil(lockMs / 1000);
  const progress  = locked ? ((totalSecs - countdown) / totalSecs) * 100 : 100;

  return createPortal(
    <>
      <style>{`
        @keyframes runaway-shake-fixed {
          0%,100%{ transform: rotate(0deg) scale(1); }
          20%    { transform: rotate(-8deg) scale(1.06); }
          40%    { transform: rotate(8deg) scale(1.06); }
          60%    { transform: rotate(-5deg) scale(1.03); }
          80%    { transform: rotate(5deg) scale(1.03); }
        }
      `}</style>
      <motion.button
        ref={btnRef}
        onClick={handleTap}
        animate={{ x: pos.x, y: pos.y }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          zIndex: 99999,
          width: 200,
          padding: '14px 20px',
          borderRadius: 16,
          background: locked ? 'rgba(15,15,30,0.85)' : `${glowColor}cc`,
          border: `1.5px solid ${glowColor}`,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: locked ? 'default' : 'pointer',
          backdropFilter: 'blur(16px)',
          boxShadow: `0 0 24px ${glowColor}44, 0 4px 20px rgba(0,0,0,0.4)`,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          animation: shaking ? 'runaway-shake-fixed 0.1s ease-in-out 6' : 'none',
          overflow: 'hidden',
          textAlign: 'center',
        } as React.CSSProperties}
        title={locked ? `Available in ${countdown}s` : 'Continue Exploring'}
      >
        {locked ? `👋 Wait ${countdown}s...` : '👋 Continue Exploring'}
        {/* Progress bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, height: 3,
          width: `${progress}%`,
          background: glowColor,
          transition: 'width 1s linear',
          borderRadius: '0 2px 2px 0',
          boxShadow: `0 0 8px ${glowColor}`,
        }} />
      </motion.button>
    </>,
    document.body
  );
}

// ─── Popup 1 ──────────────────────────────────────────────────────────────────
function Popup1({ onContinue, onClose, isDark }: { onContinue: () => void; onClose: () => void; isDark: boolean }) {
  const tokens = getTokens(isDark);
  return (
    <ModalShell onClose={onClose} glowColor="#00d9ff" isDark={isDark} tokens={tokens} activeIndex={1}>
      <PopupLayout
        left={<>
          <Mascot color="cyan" expression="wink" />
          <SpeechBubble text='💬 "More useful than another social media account."' color="#00d9ff" isDark={isDark} />
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{
              marginTop: 12,
              background: isDark ? 'rgba(0,217,255,0.1)' : 'rgba(0,217,255,0.08)',
              border: '1px solid rgba(0,217,255,0.3)',
              borderRadius: 999, padding: '5px 14px', fontSize: 12,
              color: isDark ? '#80f0ff' : '#0077aa',
            }}
          >👋 Hey explorer...</motion.div>
        </>}
        right={<div>
          <Badge text="Before you disappear into the internet…" color="#00d9ff" isDark={isDark} />
          <motion.h2
            initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: '0 0 10px', lineHeight: 1.25 }}
          >
            Let me build your personal<br />
            <motion.span
              style={{ color: '#00d9ff', display: 'inline-block' }}
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 4, repeat: Infinity }}
            >scientific intelligence profile.</motion.span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 16 }}
          >
            Discover what fascinates you across AI, Biology, Physics, Space, Engineering and Medicine.
          </motion.p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18, position: 'relative' }}>
            {/* Scan line sweeps down the list */}
            <motion.div
              style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, #00d9ff88, transparent)',
                borderRadius: 2, pointerEvents: 'none', zIndex: 2,
              }}
              initial={{ top: 0, opacity: 0 }}
              animate={{ top: ['0%', '100%', '100%'], opacity: [0, 0.8, 0] }}
              transition={{ duration: 2.5, delay: 0.5, repeat: Infinity, repeatDelay: 4, ease: 'linear' }}
            />
            {[
              ['🧠', 'Intelligence Profile',      'Track your curiosity and knowledge growth.',         0.35],
              ['🌌', 'Knowledge Map',              'Visualize hidden connections between STEM domains.', 0.42],
              ['🔬', 'Personalized Research Feed', 'Breakthroughs tailored specifically for you.',       0.49],
              ['📖', 'Research Diary',             'Save discoveries and build your own archive.',       0.56],
              ['📬', 'Intelligence Briefings',     'Receive major scientific breakthroughs.',            0.63],
            ].map(([icon, title, desc, delay]) => (
              <FeatureCard key={title as string} icon={icon as string} title={title as string} desc={desc as string} tokens={tokens} delay={delay as number} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#00d9ff,#2563eb)">
              🚀 Build My Intelligence Profile
            </PrimaryBtn>
            <SecBtn onClick={onClose} tokens={tokens}>🔍 Let Me Explore First</SecBtn>
          </div>
        </div>}
      />
    </ModalShell>
  );
}

// ─── Popup 2 ──────────────────────────────────────────────────────────────────
function Popup2({ onContinue, onClose, isDark }: { onContinue: () => void; onClose: () => void; isDark: boolean }) {
  const tokens = getTokens(isDark);
  return (
    <ModalShell onClose={onClose} glowColor="#f59e0b" isDark={isDark} tokens={tokens} activeIndex={2}>
      <PopupLayout
        left={<>
          <Mascot color="amber" expression="curious" />
          <SpeechBubble text='💬 "I can remember your curiosity if you let me."' color="#f59e0b" isDark={isDark} />
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{
              marginTop: 12,
              background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 999, padding: '5px 14px', fontSize: 12,
              color: isDark ? '#fde68a' : '#b45309',
            }}
          >
            <motion.span
              animate={{ x: [-2, 2, -2] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-block' }}
            >🥺</motion.span> Wait...
          </motion.div>
        </>}
        right={<div>
          <Badge text="Personalization Detected" color="#f59e0b" isDark={isDark} />
          <motion.h2
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: '0 0 10px', lineHeight: 1.25 }}
          >
            Wait... you're leaving <span style={{ color: '#f59e0b' }}>empty-handed?</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 14 }}
          >
            I could already start building your scientific profile. Every visitor explores different discoveries. STEAMI can remember yours.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={{
              background: tokens.bgInner, border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: 14, padding: 14, marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ color: tokens.text, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <motion.span
                  style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}
                  animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                Personal Intelligence Profile
              </span>
              <motion.span
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                style={{ background: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 999, padding: '2px 9px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <CountUp to={12} delay={0.6} color="#f59e0b" /> Discovered
              </motion.span>
            </div>
            {[['Artificial Intelligence','80%'],['Physics','65%'],['Biology','45%'],['Emerging Research','70%']].map(([label, width], i) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <p style={{ margin: '0 0 3px', fontSize: 11, color: tokens.textMuted }}>{label}</p>
                <div style={{ height: 5, background: tokens.card, borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }} animate={{ width }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                    style={{ height: '100%', background: 'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius: 3 }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#f59e0b,#d97706)">
              🧠 Save My Intelligence Profile
            </PrimaryBtn>
            <SecBtn onClick={onClose} tokens={tokens}>📚 I'll Read A Little More</SecBtn>
          </div>
        </div>}
      />
    </ModalShell>
  );
}

// ─── Popup 3 ──────────────────────────────────────────────────────────────────
function Popup3({ onContinue, onClose, isDark }: { onContinue: () => void; onClose: () => void; isDark: boolean }) {
  const tokens = getTokens(isDark);
  return (
    <ModalShell onClose={onClose} glowColor="#7c3aed" isDark={isDark} tokens={tokens} activeIndex={3}>
      <PopupLayout
        left={<>
          <Mascot color="purple" expression="surprised" />
          <SpeechBubble text={"💬 \"You're one click away from owning this.\""} color="#a78bfa" isDark={isDark} />
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{
              marginTop: 12,
              background: isDark ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(167,139,250,0.3)',
              borderRadius: 999, padding: '5px 14px', fontSize: 12,
              color: isDark ? '#ddd6fe' : '#5b21b6',
            }}
          >😯 Something interesting...</motion.div>
        </>}
        right={<div>
          <Badge text="Future Intelligence Preview" color="#a78bfa" isDark={isDark} />
          <motion.h2
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: '0 0 10px', lineHeight: 1.25 }}
          >
            STEAMI begins <span style={{ color: '#a78bfa' }}>mapping how you think.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 14 }}
          >
            Most visitors never realize that their interests form hidden connections across science and technology.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={{
              background: tokens.bgInner, border: `1px solid ${isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.25)'}`,
              borderRadius: 14, padding: 14, marginBottom: 14,
            }}
          >
            <KnowledgeWeb color="#a78bfa" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: tokens.text, fontSize: 12, fontWeight: 700 }}>YOUR INTELLIGENCE PROFILE</span>
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ color: '#a78bfa', fontSize: 10, background: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)', padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
                Profile forming…
              </motion.span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Research Depth','82%'],['Field Diversity','74%'],['Cross-Domain Thinking','91%'],['Knowledge Growth','68%']].map(([label, val], i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                  whileHover={{ scale: 1.05, borderColor: '#a78bfa' }}
                  style={{
                    background: tokens.card, border: `1px solid ${tokens.cardBorder}`,
                    borderRadius: 10, padding: '9px 11px', cursor: 'default',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                    <CountUp to={parseInt(val)} delay={0.5 + i * 0.1} color="#a78bfa" />
                  </p>
                  <p style={{ margin: 0, color: tokens.textMuted, fontSize: 10, marginTop: 2 }}>{label}</p>
                  {/* Mini sparkle that fires once */}
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0], rotate: [0, 180] }}
                    transition={{ delay: 1.2 + i * 0.15, duration: 0.6 }}
                    style={{ position: 'absolute', top: 4, right: 6, fontSize: 10, color: '#a78bfa' }}
                  >✦</motion.span>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#7c3aed,#4f46e5)">
              ✨ Start Building Mine
            </PrimaryBtn>
            <SecBtn onClick={onClose} tokens={tokens}>🙂 Maybe Later</SecBtn>
          </div>
        </div>}
      />
    </ModalShell>
  );
}

// ─── Popup 4 ──────────────────────────────────────────────────────────────────
function Popup4({ onContinue, onClose, isDark }: { onContinue: () => void; onClose: () => void; isDark: boolean }) {
  const tokens = getTokens(isDark);
  return (
    <ModalShell onClose={() => {}} showClose={false} glowColor="#2563eb" isDark={isDark} tokens={tokens} extraBg={<TearDrops color="rgba(96,165,250,0.18)" />} activeIndex={4}>
      <PopupLayout
        left={<>
          <Mascot color="blue" expression="sad" />
          <SpeechBubble text={"💙 \"I'll keep a spot ready for you.\""} color="#60a5fa" isDark={isDark} />
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{
              marginTop: 12,
              background: isDark ? 'rgba(37,99,235,0.1)' : 'rgba(37,99,235,0.07)',
              border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: 999, padding: '5px 14px', fontSize: 12,
              color: isDark ? '#bfdbfe' : '#1d4ed8',
            }}
          >💙 Before I go...</motion.div>
        </>}
        right={<div>
          <Badge text="Future Waiting For You" color="#60a5fa" isDark={isDark} />
          <motion.h2
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: '0 0 10px', lineHeight: 1.25 }}
          >
            I completely <span style={{ color: '#60a5fa' }}>understand.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 14 }}
          >
            You probably came here just to explore. That's perfectly okay.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={{
              background: tokens.bgInner, border: `1px solid ${isDark ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.2)'}`,
              borderRadius: 14, padding: 14, marginBottom: 14,
            }}
          >
            <p style={{ color: tokens.text, fontWeight: 700, fontSize: 12, marginBottom: 10, marginTop: 0 }}>Waiting To Be Unlocked</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
              {[['🧠','Intelligence Profile'],['🌌','Knowledge Map'],['📖','Research Diary'],['🔬','Research Feed'],['📬','Briefings'],['🚀','Research Signals']].map(([icon, t], i) => (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.07, type: 'spring' }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    background: tokens.card, border: `1px solid ${tokens.cardBorder}`,
                    borderRadius: 10, padding: '10px 6px', textAlign: 'center',
                  }}
                >
                  <motion.span
                    style={{ fontSize: 20, display: 'inline-block' }}
                    whileHover={{ scale: 1.4, rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.35 }}
                    animate={{ scale: [1, 1.08, 1] }}
                  >{icon}</motion.span>
                  <span style={{ color: tokens.textMuted, fontSize: 10, lineHeight: 1.3 }}>{t}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
          {/* Only the register button stays inside the popup */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            style={{ position: 'relative' }}
          >
            {/* Heartbeat glow rings */}
            {[0, 0.4, 0.8].map((d, i) => (
              <motion.div
                key={i}
                style={{
                  position: 'absolute', inset: -3, borderRadius: 17,
                  border: '1.5px solid #60a5fa',
                  opacity: 0, pointerEvents: 'none',
                }}
                animate={{ scale: [1, 1.08, 1.18], opacity: [0.6, 0.2, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: d, ease: 'easeOut' }}
              />
            ))}
            <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#0ea5e9,#2563eb)">
              💙 Save My Spot
            </PrimaryBtn>
          </motion.div>
          {/* RunawayButton is portaled to document.body — appears full-screen */}
          <RunawayButton onClose={onClose} lockMs={15000} glowColor="#60a5fa" />
        </div>}
      />
    </ModalShell>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export function OnboardingPopups() {
  const { isAuthenticated } = useAuthStore();
  const [activePopup, setActivePopup] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [authOpen, setAuthOpen]       = useState(false);
  // Which phase was active when user opened auth modal (so we can resume)
  const pendingPhaseRef = useRef<1 | 2 | 3 | 4 | null>(null);

  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthRef = useRef(isAuthenticated);
  const isDark    = useTheme();

  useEffect(() => { isAuthRef.current = isAuthenticated; }, [isAuthenticated]);

  const killTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const schedule = useCallback((popup: 1 | 2 | 3 | 4, delayMs: number) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    timerRef.current = setTimeout(() => {
      if (!isAuthRef.current && !isDone()) {
        setActivePopup(popup);
      }
    }, delayMs);
  }, []);

  // Mount once
  useEffect(() => {
    if (isAuthenticated) { markDone(); return; }
    if (isDone()) return;

    const phase     = getPhase();
    const lastClose = getLastClose();
    const now       = Date.now();

    if (phase === 0) {
      schedule(1, 25_000);
    } else if (phase >= 1 && phase <= 3) {
      const nextPopup = (phase + 1) as 2 | 3 | 4;
      const elapsed   = now - lastClose;
      const remaining = Math.max(0, 18_000 - elapsed);
      schedule(nextPopup, remaining);
    }
    // phase === 4: all popups shown this session, but because we no longer
    // call markDone() after popup 4, the loop will restart next page load.

    return killTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to auth state changes
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    const prev = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (isAuthenticated && !prev) {
      // Just logged in — stop everything
      markDone();
      killTimer();
      setActivePopup(0);
    } else if (!isAuthenticated && prev) {
      // Just logged OUT — clear done flag and restart the 25s sequence
      clearDone();
      lsRemove(SK_PHASE);
      lsRemove(SK_LAST_CLOSE);
      ssRemove(SK_SESSION); // force fresh session so mount effect re-runs logic
      killTimer();
      setActivePopup(0);
      // Small delay so any AuthModal close animation finishes first
      setTimeout(() => {
        if (!isAuthRef.current) {
          schedule(1, 25_000);
        }
      }, 500);
    }
  }, [isAuthenticated, killTimer, schedule]);

  const handleClose = (phase: 1 | 2 | 3 | 4) => {
    setActivePopup(0);
    setTimeout(() => {
      setPhase(phase);
      setLastClose();
      if (phase < 4) {
        schedule((phase + 1) as 2 | 3 | 4, 18_000);
      }
      // After popup 4: DON'T call markDone() — the loop restarts on next page load.
    }, 0);
  };

  const handleContinue = (fromPhase: 1 | 2 | 3 | 4) => {
    // Pause the sequence but remember where we were
    pendingPhaseRef.current = fromPhase;
    killTimer();
    setActivePopup(0);
    setAuthOpen(true);
  };

  const handleAuthSuccess = () => {
    setAuthOpen(false);
    pendingPhaseRef.current = null;
    markDone(); // Only mark done when user actually signs up
  };

  const handleAuthClose = () => {
    // User closed auth without signing up — resume the popup sequence
    setAuthOpen(false);
    const phase = pendingPhaseRef.current;
    pendingPhaseRef.current = null;
    if (phase !== null && !isDone()) {
      // Show the NEXT popup after 18s (treat it like they closed the current one)
      setPhase(phase);
      setLastClose();
      if (phase < 4) {
        schedule((phase + 1) as 2 | 3 | 4, 18_000);
      }
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {activePopup === 1 && (
          <Popup1 key="p1" isDark={isDark} onContinue={() => handleContinue(1)} onClose={() => handleClose(1)} />
        )}
        {activePopup === 2 && (
          <Popup2 key="p2" isDark={isDark} onContinue={() => handleContinue(2)} onClose={() => handleClose(2)} />
        )}
        {activePopup === 3 && (
          <Popup3 key="p3" isDark={isDark} onContinue={() => handleContinue(3)} onClose={() => handleClose(3)} />
        )}
        {activePopup === 4 && (
          <Popup4 key="p4" isDark={isDark} onContinue={() => handleContinue(4)} onClose={() => handleClose(4)} />
        )}
      </AnimatePresence>

      <AuthModal
        open={authOpen}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
