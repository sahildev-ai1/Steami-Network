/**
 * OnboardingPopups.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 4-stage onboarding popup system for unauthenticated STEAMI visitors.
 *
 * Timing:
 *   Popup 1 → shown after 25s on site (first visit)
 *   Popup 2 → shown 18s after popup 1 is closed (without signing up)
 *   Popup 3 → shown 18s after popup 2 is closed
 *   Popup 4 → shown 18s after popup 3 is closed
 *             "Continue Exploring" button runs away from cursor for 15s on desktop;
 *             on mobile it shakes/dodges for 15s before the popup can be closed.
 *
 * Integration:
 *   - Renders AuthModal when user clicks the primary CTA (register)
 *   - Uses `useAuthStore` to check authentication; stops if user signs in
 *   - Persists state in localStorage so popups don't repeat across sessions
 *   - Drop <OnboardingPopups /> inside App.tsx next to <AnimatedRoutes />
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AuthModal } from '@/components/AuthModal';

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SK_PHASE      = 'steami_ob_phase';   // which popup stage we're at (1-4)
const SK_LAST_CLOSE = 'steami_ob_lclose';  // timestamp of last popup close
const SK_DONE       = 'steami_ob_done';    // '1' when user signed up or all 4 shown

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPhase(): number      { return parseInt(localStorage.getItem(SK_PHASE) ?? '0', 10); }
function setPhase(n: number)     { localStorage.setItem(SK_PHASE, String(n)); }
function getLastClose(): number  { return parseInt(localStorage.getItem(SK_LAST_CLOSE) ?? '0', 10); }
function setLastClose()          { localStorage.setItem(SK_LAST_CLOSE, String(Date.now())); }
function markDone()              { localStorage.setItem(SK_DONE, '1'); }
function isDone(): boolean       { return localStorage.getItem(SK_DONE) === '1'; }

// ─── 3-D Mascot via CSS / SVG ─────────────────────────────────────────────────
// Each popup has its own colour palette + expression

interface MascotProps {
  color: 'cyan' | 'amber' | 'purple' | 'blue';
  expression: 'wink' | 'curious' | 'surprised' | 'sad';
}

function Mascot({ color, expression }: MascotProps) {
  const palettes = {
    cyan:   { body: '#0ff', glow: '#00d9ff', face: '#00a8c8', shine: '#80ffff', tear: false },
    amber:  { body: '#fbbf24', glow: '#f59e0b', face: '#d97706', shine: '#fde68a', tear: false },
    purple: { body: '#a78bfa', glow: '#7c3aed', face: '#6d28d9', shine: '#ddd6fe', tear: false },
    blue:   { body: '#60a5fa', glow: '#2563eb', face: '#1d4ed8', shine: '#bfdbfe', tear: true },
  };
  const p = palettes[color];

  // Expression-specific SVG eyes/mouth paths
  const expressions: Record<string, JSX.Element> = {
    wink: (
      <g>
        {/* Left eye open */}
        <ellipse cx="38" cy="48" rx="7" ry="8" fill="#0a0a1a" />
        <ellipse cx="40" cy="46" rx="2.5" ry="2.5" fill="white" opacity="0.85" />
        {/* Right eye winking */}
        <path d="M55 49 Q62 44 69 49" stroke="#0a0a1a" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Smile */}
        <path d="M40 62 Q53 72 66 62" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Blush cheeks */}
        <ellipse cx="32" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.35" />
        <ellipse cx="74" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.35" />
      </g>
    ),
    curious: (
      <g>
        {/* Wide eyes */}
        <ellipse cx="38" cy="47" rx="8" ry="9" fill="#0a0a1a" />
        <ellipse cx="40" cy="45" rx="3" ry="3" fill="white" opacity="0.85" />
        <ellipse cx="68" cy="47" rx="8" ry="9" fill="#0a0a1a" />
        <ellipse cx="70" cy="45" rx="3" ry="3" fill="white" opacity="0.85" />
        {/* Slightly open surprised mouth */}
        <ellipse cx="53" cy="66" rx="8" ry="5" fill="#0a0a1a" opacity="0.8" />
        {/* Blush cheeks */}
        <ellipse cx="28" cy="60" rx="7" ry="4" fill="#ff6b9d" opacity="0.3" />
        <ellipse cx="78" cy="60" rx="7" ry="4" fill="#ff6b9d" opacity="0.3" />
      </g>
    ),
    surprised: (
      <g>
        {/* Very wide eyes with sparkle */}
        <ellipse cx="37" cy="46" rx="9" ry="10" fill="#0a0a1a" />
        <ellipse cx="39" cy="43" rx="3.5" ry="3.5" fill="white" opacity="0.85" />
        <ellipse cx="69" cy="46" rx="9" ry="10" fill="#0a0a1a" />
        <ellipse cx="71" cy="43" rx="3.5" ry="3.5" fill="white" opacity="0.85" />
        {/* Tiny star inside left eye */}
        <text x="33" y="50" fontSize="6" fill="white" opacity="0.6">✦</text>
        <text x="65" y="50" fontSize="6" fill="white" opacity="0.6">✦</text>
        {/* Wide open mouth */}
        <ellipse cx="53" cy="67" rx="10" ry="7" fill="#0a0a1a" opacity="0.85" />
        <path d="M44 67 Q53 74 62 67" fill="#ff4466" opacity="0.7" />
        {/* Blush cheeks */}
        <ellipse cx="26" cy="58" rx="8" ry="5" fill="#ff6b9d" opacity="0.4" />
        <ellipse cx="80" cy="58" rx="8" ry="5" fill="#ff6b9d" opacity="0.4" />
      </g>
    ),
    sad: (
      <g>
        {/* Droopy eyes */}
        <ellipse cx="38" cy="49" rx="7" ry="8" fill="#0a0a1a" />
        <ellipse cx="40" cy="47" rx="2.5" ry="2.5" fill="white" opacity="0.85" />
        <ellipse cx="68" cy="49" rx="7" ry="8" fill="#0a0a1a" />
        <ellipse cx="70" cy="47" rx="2.5" ry="2.5" fill="white" opacity="0.85" />
        {/* Sad brows */}
        <path d="M30 38 Q38 35 43 39" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M63 39 Q68 35 76 38" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Sad mouth */}
        <path d="M42 66 Q53 59 64 66" stroke="#0a0a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Tear drop */}
        <ellipse cx="70" cy="60" rx="3" ry="4" fill="#60a5fa" opacity="0.7" />
        <path d="M70 64 Q67 70 70 73 Q73 70 70 64" fill="#60a5fa" opacity="0.7" />
        {/* Blush */}
        <ellipse cx="28" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.25" />
        <ellipse cx="78" cy="62" rx="7" ry="4" fill="#ff6b9d" opacity="0.25" />
      </g>
    ),
  };

  // Floating + bobbing animation
  const floatVariants = {
    animate: {
      y: [0, -12, 0, -8, 0],
      rotate: [-1, 1, -1],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
  };

  return (
    <motion.div
      variants={floatVariants}
      animate="animate"
      style={{ filter: `drop-shadow(0 0 32px ${p.glow}88)` }}
    >
      <svg width="140" height="140" viewBox="0 0 106 106" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`bodyGrad-${color}`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={p.shine} stopOpacity="0.9" />
            <stop offset="45%" stopColor={p.body} />
            <stop offset="100%" stopColor={p.face} />
          </radialGradient>
          <radialGradient id={`innerGrad-${color}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.glow} stopOpacity="0.15" />
            <stop offset="100%" stopColor={p.face} stopOpacity="0.05" />
          </radialGradient>
          {/* Subtle 3-D rim light */}
          <radialGradient id={`rimGrad-${color}`} cx="85%" cy="85%" r="40%">
            <stop offset="0%" stopColor={p.shine} stopOpacity="0.5" />
            <stop offset="100%" stopColor={p.body} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Holographic base ring glow */}
        <ellipse cx="53" cy="96" rx="34" ry="8" fill={p.body} opacity="0.15" />
        <ellipse cx="53" cy="96" rx="22" ry="5" fill={p.glow} opacity="0.25" />

        {/* Main body sphere */}
        <circle cx="53" cy="52" r="44" fill={`url(#bodyGrad-${color})`} />
        {/* Inner depth */}
        <circle cx="53" cy="52" r="40" fill={`url(#innerGrad-${color})`} />
        {/* Rim light for 3-D */}
        <circle cx="53" cy="52" r="44" fill={`url(#rimGrad-${color})`} />
        {/* Glassy top shine */}
        <ellipse cx="42" cy="30" rx="16" ry="10" fill="white" opacity="0.22" />
        <ellipse cx="38" cy="26" rx="8" ry="5" fill="white" opacity="0.35" />
        {/* Soft outline ring */}
        <circle cx="53" cy="52" r="44" fill="none" stroke={p.shine} strokeWidth="0.5" opacity="0.4" />

        {/* Expression */}
        {expressions[expression]}

        {/* Tiny hands (cute paws) */}
        <ellipse cx="14" cy="70" rx="10" ry="8" fill={p.body} />
        <ellipse cx="14" cy="70" rx="10" ry="8" fill={`url(#rimGrad-${color})`} />
        <ellipse cx="10" cy="67" rx="3.5" ry="3" fill={p.shine} opacity="0.5" />
        <ellipse cx="93" cy="70" rx="10" ry="8" fill={p.body} />
        <ellipse cx="93" cy="70" rx="10" ry="8" fill={`url(#rimGrad-${color})`} />
        <ellipse cx="97" cy="67" rx="3.5" ry="3" fill={p.shine} opacity="0.5" />
      </svg>
    </motion.div>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
function SpeechBubble({ text, color }: { text: string; color: string }) {
  return (
    <div style={{
      background: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: 16,
      padding: '10px 16px',
      marginTop: 12,
      position: 'relative',
      maxWidth: 220,
      textAlign: 'center',
    }}>
      {/* Triangle pointer up */}
      <div style={{
        position: 'absolute',
        top: -9,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '9px solid transparent',
        borderRight: '9px solid transparent',
        borderBottom: `9px solid ${color}40`,
      }} />
      <p style={{ color, fontSize: 13, margin: 0, fontStyle: 'italic' }}>{text}</p>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
interface ShellProps {
  onClose: () => void;
  children: React.ReactNode;
  glowColor: string;
  borderColor: string;
  showClose?: boolean;
}

function ModalShell({ onClose, children, glowColor, borderColor, showClose = true }: ShellProps) {
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
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(8px)',
        }}
      />
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 36 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
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
            maxWidth: 840,
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            borderRadius: 24,
            border: `1px solid ${borderColor}`,
            background: 'rgba(8, 12, 30, 0.94)',
            backdropFilter: 'blur(32px)',
            boxShadow: `0 0 80px ${glowColor}22, 0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
          }}
        >
          {/* Glow blobs */}
          <div style={{
            position: 'absolute', top: -60, left: -60, width: 220, height: 220,
            borderRadius: '50%', background: `${glowColor}20`, filter: 'blur(48px)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, right: -60, width: 220, height: 220,
            borderRadius: '50%', background: `${glowColor}14`, filter: 'blur(48px)',
            pointerEvents: 'none',
          }} />

          {/* Close button */}
          {showClose && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                transition: 'background 0.2s, color 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
                (e.currentTarget as HTMLButtonElement).style.color = '#fff';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)';
              }}
            >
              <X size={16} />
            </button>
          )}

          <div style={{ padding: '32px 28px 28px' }}>
            {children}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Shared layout ────────────────────────────────────────────────────────────
function PopupLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)',
      gap: 28,
      alignItems: 'center',
    }}
    className="popup-grid"
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
        {left}
      </div>
      <div>{right}</div>

      <style>{`
        @media (max-width: 640px) {
          .popup-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── CTA Button ───────────────────────────────────────────────────────────────
function PrimaryBtn({ onClick, children, gradient }: { onClick: () => void; children: React.ReactNode; gradient: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: gradient,
        border: 'none',
        borderRadius: 14,
        padding: '14px 20px',
        color: '#fff',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        flex: 1,
        minWidth: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}

// ─── Runaway button (Popup 4) ─────────────────────────────────────────────────
function RunawayButton({ onClose, lockMs = 15000 }: { onClose: () => void; lockMs?: number }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState(true);
  const [countdown, setCountdown] = useState(Math.ceil(lockMs / 1000));
  const btnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useRef(window.matchMedia('(pointer: coarse)').matches);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setLocked(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Desktop: flee from cursor
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!locked || isMobile.current || !btnRef.current) return;
    const btn = btnRef.current;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 120) {
      // Flee in the opposite direction
      const angle = Math.atan2(dy, dx);
      const flee = 80 + (120 - dist) * 1.5;
      let nx = pos.x - Math.cos(angle) * flee;
      let ny = pos.y - Math.sin(angle) * flee;
      // Keep within viewport with margin
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 20;
      nx = Math.max(-rect.left + margin, Math.min(vw - rect.right - margin, nx));
      ny = Math.max(-rect.top + margin, Math.min(vh - rect.bottom - margin, ny));
      setPos({ x: nx, y: ny });
    }
  }, [locked, pos]);

  useEffect(() => {
    if (isMobile.current) return;
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Mobile shake animation when tapped while locked
  const [shaking, setShaking] = useState(false);
  const handleTap = () => {
    if (!locked) { onClose(); return; }
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const shakeKeyframes = shaking
    ? 'runaway-shake 0.1s ease-in-out 6'
    : 'none';

  return (
    <>
      <style>{`
        @keyframes runaway-shake {
          0%,100%{transform:translateX(var(--rx,0px)) rotate(0deg)}
          25%{transform:translateX(calc(var(--rx,0px) + 10px)) rotate(3deg)}
          75%{transform:translateX(calc(var(--rx,0px) - 10px)) rotate(-3deg)}
        }
      `}</style>
      <motion.button
        ref={btnRef}
        onClick={handleTap}
        animate={{ x: pos.x, y: pos.y }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          '--rx': `${pos.x}px`,
          background: locked ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 14,
          padding: '14px 20px',
          color: locked ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
          fontSize: 15,
          cursor: locked ? 'not-allowed' : 'pointer',
          flex: 1,
          minWidth: 0,
          animation: shakeKeyframes,
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        } as React.CSSProperties}
        title={locked ? `Available in ${countdown}s` : ''}
      >
        {locked ? `👋 Wait ${countdown}s...` : '👋 Continue Exploring'}
        {/* Countdown progress bar */}
        {locked && (
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, height: 3,
            width: `${(countdown / (lockMs / 1000)) * 100}%`,
            background: 'rgba(255,255,255,0.3)',
            transition: 'width 1s linear',
            borderRadius: '0 2px 2px 0',
          }} />
        )}
      </motion.button>
    </>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: 999,
      padding: '4px 12px',
      fontSize: 10,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color,
      marginBottom: 12,
      fontWeight: 600,
    }}>{text}</span>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '10px 14px',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 600 }}>{title}</p>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Popup 1 — "Build my intelligence profile" ────────────────────────────────
function Popup1({ onContinue, onClose }: { onContinue: () => void; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} glowColor="#00d9ff" borderColor="rgba(0,217,255,0.15)">
      <PopupLayout
        left={
          <>
            <Mascot color="cyan" expression="wink" />
            <SpeechBubble text='💬 "More useful than another social media account."' color="#00d9ff" />
            <div style={{
              marginTop: 14,
              background: 'rgba(0,217,255,0.1)',
              border: '1px solid rgba(0,217,255,0.25)',
              borderRadius: 999, padding: '6px 16px',
              fontSize: 13, color: '#80f0ff',
            }}>👋 Hey explorer...</div>
          </>
        }
        right={
          <div>
            <Badge text="Before you disappear into the internet..." color="#00d9ff" />
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.2 }}>
              Let me build your personal<br />
              <span style={{ color: '#00d9ff' }}>scientific intelligence profile.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 20 }}>
              Discover what fascinates you across AI, Biology, Physics, Space, Engineering and Medicine.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <FeatureCard icon="🧠" title="Intelligence Profile" desc="Track your curiosity and knowledge growth." />
              <FeatureCard icon="🌌" title="Knowledge Map" desc="Visualize hidden connections between STEM domains." />
              <FeatureCard icon="🔬" title="Personalized Research Feed" desc="Breakthroughs tailored specifically for you." />
              <FeatureCard icon="📖" title="Research Diary" desc="Save discoveries and build your own archive." />
              <FeatureCard icon="📬" title="Intelligence Briefings" desc="Receive major scientific breakthroughs." />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#00d9ff,#2563eb)">
                🚀 Build My Intelligence Profile
              </PrimaryBtn>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14, padding: '14px 20px', color: 'rgba(255,255,255,0.7)',
                  fontSize: 15, cursor: 'pointer', flex: 1, minWidth: 0,
                }}
              >
                🔍 Let Me Explore First
              </button>
            </div>
          </div>
        }
      />
    </ModalShell>
  );
}

// ─── Popup 2 — "You're leaving empty-handed?" ────────────────────────────────
function Popup2({ onContinue, onClose }: { onContinue: () => void; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} glowColor="#f59e0b" borderColor="rgba(245,158,11,0.15)">
      <PopupLayout
        left={
          <>
            <Mascot color="amber" expression="curious" />
            <SpeechBubble text='💬 "I can remember your curiosity if you let me."' color="#f59e0b" />
            <div style={{
              marginTop: 14,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 999, padding: '6px 16px', fontSize: 13, color: '#fde68a',
            }}>🥺 Wait...</div>
          </>
        }
        right={
          <div>
            <Badge text="Personalization Detected" color="#f59e0b" />
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.2 }}>
              Wait... you're leaving empty-handed?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 20 }}>
              I could already start building your scientific profile.
              Every visitor explores different discoveries. STEAMI can remember yours.
            </p>

            {/* Profile preview */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 16, padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Personal Intelligence Profile</span>
                <span style={{
                  background: 'rgba(245,158,11,0.2)', color: '#fde68a',
                  borderRadius: 999, padding: '3px 10px', fontSize: 11,
                }}>12% Discovered</span>
              </div>
              {[['Artificial Intelligence', '80%'], ['Physics', '65%'], ['Biology', '45%'], ['Emerging Research', '70%']].map(([label, width]) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</p>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width, height: '100%', background: 'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[['🧠','Personalized Dashboard'], ['🔬','Custom Research Feed'], ['📖','Research Diary'], ['📬','Intelligence Briefings']].map(([icon, t]) => (
                <div key={t} style={{
                  display: 'flex', gap: 8, alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '8px 12px',
                }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ color: '#fff', fontSize: 12 }}>{t}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#f59e0b,#d97706)">
                🧠 Save My Intelligence Profile
              </PrimaryBtn>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14, padding: '14px 20px', color: 'rgba(255,255,255,0.7)',
                fontSize: 15, cursor: 'pointer', flex: 1, minWidth: 0,
              }}>📚 I'll Read A Little More</button>
            </div>
          </div>
        }
      />
    </ModalShell>
  );
}

// ─── Popup 3 — "STEAMI begins mapping how you think" ─────────────────────────
function Popup3({ onContinue, onClose }: { onContinue: () => void; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} glowColor="#7c3aed" borderColor="rgba(124,58,237,0.15)">
      <PopupLayout
        left={
          <>
            <Mascot color="purple" expression="surprised" />
            <SpeechBubble text={"💬 \"You're one click away from owning this.\""} color="#a78bfa" />
            <div style={{
              marginTop: 14,
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: 999, padding: '6px 16px', fontSize: 13, color: '#ddd6fe',
            }}>😯 Something interesting...</div>
          </>
        }
        right={
          <div>
            <Badge text="Future Intelligence Preview" color="#a78bfa" />
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 10px', lineHeight: 1.2 }}>
              STEAMI begins <span style={{ color: '#a78bfa' }}>mapping how you think.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 18 }}>
              Most visitors never realize that their interests form hidden connections across science and technology.
            </p>

            {/* Profile metrics */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 16, padding: 16, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>YOUR INTELLIGENCE PROFILE</span>
                <span style={{ color: '#a78bfa', fontSize: 11, background: 'rgba(124,58,237,0.2)', padding: '2px 8px', borderRadius: 999 }}>Profile forming...</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Research Depth','82%'],['Field Diversity','74%'],['Cross-Domain Thinking','91%'],['Knowledge Growth','68%']].map(([label, val]) => (
                  <div key={label} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '10px 12px',
                  }}>
                    <p style={{ margin: 0, color: '#a78bfa', fontSize: 18, fontWeight: 700 }}>{val}</p>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Knowledge nodes */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,217,255,0.1)',
              borderRadius: 14, padding: 14, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Knowledge Map Preview</span>
                <span style={{ color: '#00d9ff', fontSize: 11 }}>✦ Pathways Detected</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Artificial Intelligence','Physics','Biology','Medicine','Space','Engineering','Mathematics'].map(t => (
                  <span key={t} style={{
                    background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.2)',
                    borderRadius: 999, padding: '4px 10px', fontSize: 11, color: '#7dd3fc',
                  }}>{t}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#7c3aed,#4f46e5)">
                ✨ Start Building Mine
              </PrimaryBtn>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14, padding: '14px 20px', color: 'rgba(255,255,255,0.7)',
                fontSize: 15, cursor: 'pointer', flex: 1, minWidth: 0,
              }}>🙂 Maybe Later</button>
            </div>
          </div>
        }
      />
    </ModalShell>
  );
}

// ─── Popup 4 — "I completely understand." (runaway close btn) ────────────────
function Popup4({ onContinue, onClose }: { onContinue: () => void; onClose: () => void }) {
  return (
    <ModalShell onClose={() => {}} showClose={false} glowColor="#2563eb" borderColor="rgba(96,165,250,0.15)">
      <PopupLayout
        left={
          <>
            <Mascot color="blue" expression="sad" />
            <SpeechBubble text={"💙 \"I'll keep a spot ready for you.\""} color="#60a5fa" />
            <div style={{
              marginTop: 14,
              background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: 999, padding: '6px 16px', fontSize: 13, color: '#bfdbfe',
            }}>💙 Before I go...</div>
          </>
        }
        right={
          <div>
            <Badge text="Future Waiting For You" color="#60a5fa" />
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 10px', lineHeight: 1.2 }}>
              I completely <span style={{ color: '#60a5fa' }}>understand.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 18 }}>
              You probably came here just to explore. That's perfectly okay.
            </p>

            {/* Feature grid */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(96,165,250,0.12)',
              borderRadius: 16, padding: 16, marginBottom: 14,
            }}>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 12, marginTop: 0 }}>Waiting To Be Unlocked</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[['🧠','Intelligence Profile'],['🌌','Knowledge Map'],['📖','Research Diary'],['🔬','Research Feed'],['📬','Briefings'],['🚀','Research Signals']].map(([icon, t]) => (
                  <div key={t} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: '12px 8px', textAlign: 'center',
                  }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 1.3 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Promises */}
            <div style={{
              background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)',
              borderRadius: 14, padding: 14, marginBottom: 18,
            }}>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 8, marginTop: 0 }}>If you ever return, I'd love to remember:</p>
              {['What fascinated you','What discoveries surprised you','What ideas you wanted to explore'].map(t => (
                <p key={t} style={{ margin: '4px 0', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>• {t}</p>
              ))}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Because <span style={{ color: '#60a5fa' }}>STEAMI</span> becomes more useful as it grows with you.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <PrimaryBtn onClick={onContinue} gradient="linear-gradient(135deg,#0ea5e9,#2563eb)">
                💙 Save My Spot
              </PrimaryBtn>
              {/* The runaway "Continue Exploring" button */}
              <RunawayButton onClose={onClose} lockMs={15000} />
            </div>
          </div>
        }
      />
    </ModalShell>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export function OnboardingPopups() {
  const { isAuthenticated } = useAuthStore();
  const [activePopup, setActivePopup] = useState<0 | 1 | 2 | 3 | 4>(0); // 0 = none
  const [authOpen, setAuthOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const scheduleNext = useCallback((popup: 1 | 2 | 3 | 4, delay: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (!isDone()) setActivePopup(popup);
    }, delay);
  }, []);

  useEffect(() => {
    // If user is authenticated, never show
    if (isAuthenticated) {
      markDone();
      clearTimer();
      setActivePopup(0);
      return;
    }
    if (isDone()) return;

    const phase = getPhase();
    const lastClose = getLastClose();
    const now = Date.now();

    if (phase === 0) {
      // First visit — show popup 1 after 25s
      scheduleNext(1, 25_000);
    } else if (phase >= 1 && phase <= 3) {
      // Subsequent popups — 18s after the last close
      const nextPopup = (phase + 1) as 2 | 3 | 4;
      const elapsed = now - lastClose;
      const remaining = Math.max(0, 18_000 - elapsed);
      scheduleNext(nextPopup, remaining);
    }
  }, [isAuthenticated, scheduleNext]);

  // Stop immediately on auth
  useEffect(() => {
    if (isAuthenticated) { markDone(); clearTimer(); setActivePopup(0); }
  }, [isAuthenticated]);

  const handleClose = (phase: 1 | 2 | 3 | 4) => {
    setActivePopup(0);
    setPhase(phase);
    setLastClose();
    if (phase < 4) {
      scheduleNext((phase + 1) as 2 | 3 | 4, 18_000);
    } else {
      markDone();
    }
  };

  const handleContinue = () => {
    // Open the AuthModal (register flow)
    setActivePopup(0);
    clearTimer();
    setAuthOpen(true);
  };

  const handleAuthSuccess = () => {
    setAuthOpen(false);
    markDone();
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {activePopup === 1 && (
          <Popup1 key="p1" onContinue={handleContinue} onClose={() => handleClose(1)} />
        )}
        {activePopup === 2 && (
          <Popup2 key="p2" onContinue={handleContinue} onClose={() => handleClose(2)} />
        )}
        {activePopup === 3 && (
          <Popup3 key="p3" onContinue={handleContinue} onClose={() => handleClose(3)} />
        )}
        {activePopup === 4 && (
          <Popup4 key="p4" onContinue={handleContinue} onClose={() => handleClose(4)} />
        )}
      </AnimatePresence>

      {/* Auth modal — same as the one used in SteamiNav */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
