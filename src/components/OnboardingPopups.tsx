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

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AuthModal } from '@/components/AuthModal';

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SK_PHASE      = 'steami_ob_phase';
const SK_LAST_CLOSE = 'steami_ob_lclose';
// NOTE: SK_DONE is now only set when the user actually signs up.
// The popup loop restarts on each page load if the user never signed up.
const SK_DONE       = 'steami_ob_done';

function getPhase(): number     { return parseInt(localStorage.getItem(SK_PHASE) ?? '0', 10); }
function setPhase(n: number)    { localStorage.setItem(SK_PHASE, String(n)); }
function getLastClose(): number { return parseInt(localStorage.getItem(SK_LAST_CLOSE) ?? '0', 10); }
function setLastClose()         { localStorage.setItem(SK_LAST_CLOSE, String(Date.now())); }
function markDone()             { localStorage.setItem(SK_DONE, '1'); }
function isDone(): boolean      { return localStorage.getItem(SK_DONE) === '1'; }

if (typeof window !== 'undefined') {
  (window as any).__resetSteamiPopups = () => {
    [SK_PHASE, SK_LAST_CLOSE, SK_DONE].forEach(k => localStorage.removeItem(k));
    console.log('[STEAMI] Popup state cleared. Reload to restart.');
  };
}

// ─── Theme detection ──────────────────────────────────────────────────────────
function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    // Support both Tailwind class strategy and OS preference
    return document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const mqHandler = (e: MediaQueryListEvent) => {
      if (!document.documentElement.classList.contains('dark') &&
          !document.documentElement.classList.contains('light')) {
        setIsDark(e.matches);
      }
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

// ─── Floating particles ────────────────────────────────────────────────────────
function Particles({ color }: { color: string }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 4,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 24 }}>
      {particles.map(p => (
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
          animate={{ opacity: [0, 0.7, 0], y: [0, -30, -60], scale: [0.5, 1, 0.3] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─── Pulse ring ───────────────────────────────────────────────────────────────
function PulseRing({ color }: { color: string }) {
  return (
    <motion.div
      style={{
        position: 'absolute', inset: -4,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        opacity: 0,
      }}
      animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
    />
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
        animate={{ y: [0, -12, 0, -8, 0], rotate: [-1, 1, -1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
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
        </svg>
      </motion.div>
    </div>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
function SpeechBubble({ text, color, isDark }: { text: string; color: string; isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
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
}

function ModalShell({ onClose, children, glowColor, isDark, showClose = true, tokens }: ShellProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: tokens.backdropBg,
          backdropFilter: 'blur(10px)',
        }}
      />
      {/* Card wrapper — no overflow so RunawayButton can portal outside */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 24 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            pointerEvents: 'all',
            position: 'relative',
            width: '100%',
            maxWidth: 860,
            // No overflow, no maxHeight scroll — content must fit
            borderRadius: 24,
            border: `1px solid ${isDark ? `${glowColor}25` : `${glowColor}30`}`,
            background: tokens.bg,
            backdropFilter: 'blur(40px)',
            boxShadow: `0 0 80px ${glowColor}22, ${tokens.shadow}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)'}`,
          }}
        >
          <Particles color={glowColor} />

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

          {/* Progress dots */}
          <div style={{
            position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6,
          }}>
            {[1,2,3,4].map(n => (
              <motion.div
                key={n}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: glowColor,
                }}
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2, delay: n * 0.2, repeat: Infinity }}
              />
            ))}
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

          <div style={{ padding: '36px 28px 26px' }}>
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
  show: { transition: { staggerChildren: 0.07 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
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
          .steami-popup-grid { grid-template-columns: 1fr !important; }
        }
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
      `}</style>
    </motion.div>
  );
}

// ─── CTA Button ───────────────────────────────────────────────────────────────
function PrimaryBtn({ onClick, children, gradient }: { onClick: () => void; children: React.ReactNode; gradient: string }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: gradient,
        border: 'none',
        borderRadius: 14,
        padding: '13px 20px',
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        flex: 1,
        minWidth: 0,
        backgroundSize: '200% auto',
        animation: 'ob-shimmer 3s linear infinite',
        backgroundImage: `${gradient}, linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(255,255,255,0.12) 100%)`,
      }}
    >
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
      <motion.span animate={{ rotate: [0, 20, -20, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>✦</motion.span>
      {text}
    </motion.span>
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
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 3, delay: delay + 1, repeat: Infinity, repeatDelay: 4 }}
        style={{ fontSize: 20, flexShrink: 0 }}
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
    <ModalShell onClose={onClose} glowColor="#00d9ff" isDark={isDark} tokens={tokens}>
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
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: '0 0 10px', lineHeight: 1.25 }}
          >
            Let me build your personal<br />
            <span style={{ color: '#00d9ff' }}>scientific intelligence profile.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 16 }}
          >
            Discover what fascinates you across AI, Biology, Physics, Space, Engineering and Medicine.
          </motion.p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
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
    <ModalShell onClose={onClose} glowColor="#f59e0b" isDark={isDark} tokens={tokens}>
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
          >🥺 Wait...</motion.div>
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
              <span style={{ color: tokens.text, fontSize: 12, fontWeight: 700 }}>Personal Intelligence Profile</span>
              <span style={{ background: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 999, padding: '2px 9px', fontSize: 10 }}>12% Discovered</span>
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
    <ModalShell onClose={onClose} glowColor="#7c3aed" isDark={isDark} tokens={tokens}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: tokens.text, fontSize: 12, fontWeight: 700 }}>YOUR INTELLIGENCE PROFILE</span>
              <span style={{ color: '#a78bfa', fontSize: 10, background: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)', padding: '2px 8px', borderRadius: 999 }}>Profile forming…</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Research Depth','82%'],['Field Diversity','74%'],['Cross-Domain Thinking','91%'],['Knowledge Growth','68%']].map(([label, val], i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.08, type: 'spring' }}
                  style={{
                    background: tokens.card, border: `1px solid ${tokens.cardBorder}`,
                    borderRadius: 10, padding: '9px 11px',
                  }}
                >
                  <p style={{ margin: 0, color: '#a78bfa', fontSize: 18, fontWeight: 800 }}>{val}</p>
                  <p style={{ margin: 0, color: tokens.textMuted, fontSize: 10, marginTop: 2 }}>{label}</p>
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
    <ModalShell onClose={() => {}} showClose={false} glowColor="#2563eb" isDark={isDark} tokens={tokens}>
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
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ color: tokens.textMuted, fontSize: 10, lineHeight: 1.3 }}>{t}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
          {/* Only the register button stays inside the popup */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
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

  // Kill sequence if user logs in
  useEffect(() => {
    if (isAuthenticated) { markDone(); killTimer(); setActivePopup(0); }
  }, [isAuthenticated, killTimer]);

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
