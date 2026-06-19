/**
 * SteamiNav.tsx  (updated)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from original:
 *   1. "HOME" removed from navLinks — the STEAMI logo IS the home link now
 *   2. STEAMI title always navigates to "/" (landing page) — no preventDefault
 *      when already on "/", so users can always click back to the hero
 *   3. Everything else unchanged
 */

import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSteamiStore } from '@/stores/steami-store';
import { useThemeStore } from '@/stores/theme-store';
import { useAuthStore } from '@/stores/auth-store';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sun, Moon, LogIn, LogOut, ChevronDown, User,
  Bell, BookOpen, FlaskConical, Newspaper, X, ChevronRight,
  Mail,
} from 'lucide-react';
import { AuthModal }       from '@/components/AuthModal';
import { OnboardingModal } from '@/components/OnboardingModal';
import { NewsletterModal } from '@/components/NewsletterModal';
import { useNewsletterPopup } from '@/hooks/use-newsletter-popup';
import { api } from '@/lib/api';
import { formatShortUserName, getInitials } from '@/lib/user-display';

// ── Notification types ────────────────────────────────────────────────────────

type ContentType = 'explainer' | 'research' | 'blog';

interface NotificationItem {
  id:         string;
  type:       ContentType;
  title:      string;
  field:      string;
  image:      string;
  created_at: string;
  url:        string;
}

const TYPE_META: Record<ContentType, { label: string; Icon: React.ElementType; color: string }> = {
  explainer: { label: 'Explainer',        Icon: BookOpen,     color: '#00d9ff' },
  research:  { label: 'Research Article', Icon: FlaskConical, color: '#ff4ef0' },
  blog:      { label: 'Intelligence',     Icon: Newspaper,    color: '#e8b84b' },
};

const NOTIF_STORAGE_KEY   = 'steami_notif_since';
const NOTIF_POLL_INTERVAL = 60_000;

function getNotifSince(): string {
  return localStorage.getItem(NOTIF_STORAGE_KEY) ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
}
function saveNotifSince(iso: string) {
  localStorage.setItem(NOTIF_STORAGE_KEY, iso);
}
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return m <= 1 ? 'just now' : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Main nav component ────────────────────────────────────────────────────────

export function SteamiNav() {
  const location    = useLocation();
  const diaryCount  = useSteamiStore((s) => s.diary.length);
  const { theme, toggleTheme } = useThemeStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [authOpen,      setAuthOpen]      = useState(false);
  const [onboardOpen,   setOnboardOpen]   = useState(false);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null);
  const isLight = theme === 'light';

  // NEWSLETTER
  const [nlOpen, setNlOpen] = useState(false);
  const [nlMode, setNlMode] = useState<'subscribe' | 'unsubscribe'>('subscribe');
  const nlPopup             = useNewsletterPopup();

  useEffect(() => {
    if (nlPopup.mode) {
      setNlMode(nlPopup.mode);
      setNlOpen(true);
    }
  }, [nlPopup.mode]);

  // ── Notification state ──────────────────────────────────────────────────────
  const [notifItems,   setNotifItems]   = useState<NotificationItem[]>([]);
  const [notifUnread,  setNotifUnread]  = useState(0);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifPanelRef                   = useRef<HTMLDivElement>(null);
  const notifPollerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Nav links — Home option added as the first nav option ───
  const navLinks = [
    { path: '/',            label: 'HOME' },
    { path: '/explainers',  label: 'EXPLAINERS' },
    { path: '/blog',        label: 'INTELLIGENCE' },
    { path: '/research',    label: 'RESEARCH' },
    { path: '/simulations', label: 'SIMULATIONS' },
    ...(isAuthenticated ? [{ path: '/dashboard', label: 'DASHBOARD' }] : []),
    ...(user?.role === 'mod' || user?.role === 'admin' ? [{ path: '/moderation', label: 'MOD' }]    : []),
    ...(user?.role === 'admin'                          ? [{ path: '/admin',      label: 'ADMIN' }]  : []),
    ...(user?.role === 'admin'                          ? [{ path: '/api-console',label: 'API' }]    : []),
  ];

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
    setUserMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname, closeMenu]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!isAuthenticated) { setAvatarUrl(null); return; }
    api.profile.me()
      .then((data: any) => {
        const u = data?.user ?? data;
        setAvatarUrl(u?.avatar_url ?? u?.google_picture ?? null);
      })
      .catch(() => setAvatarUrl(null));
  }, [isAuthenticated]);

  // ── Notification fetch ──────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const since = getNotifSince();
      const data  = await api.notifications.latest(since, 20) as {
        total: number; since: string; items: NotificationItem[];
      };
      if (data.items.length > 0) {
        setNotifItems(prev => {
          const existing = new Set(prev.map(i => `${i.type}:${i.id}`));
          const fresh    = data.items.filter(i => !existing.has(`${i.type}:${i.id}`));
          return [...fresh, ...prev].slice(0, 50);
        });
        setNotifUnread(prev => prev + data.items.length);
        const newest = data.items.reduce((a, b) => a.created_at > b.created_at ? a : b);
        saveNotifSince(new Date(new Date(newest.created_at).getTime() + 1).toISOString());
      }
    } catch {
      // silent — will retry on next interval
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    notifPollerRef.current = setInterval(fetchNotifications, NOTIF_POLL_INTERVAL);
    return () => { if (notifPollerRef.current) clearInterval(notifPollerRef.current); };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!notifOpen) return;
    const onKey   = (e: KeyboardEvent) => { if (e.key === 'Escape') setNotifOpen(false); };
    const onClick = (e: MouseEvent)    => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [notifOpen]);

  const handleNotifOpen = () => {
    setNotifOpen(v => {
      if (!v) setNotifUnread(0);
      return !v;
    });
  };

  const clearAllNotifs = () => {
    setNotifItems([]);
    setNotifUnread(0);
    saveNotifSince(new Date().toISOString());
  };

  const handleAuthSuccess = () => {
    setAuthOpen(false);
    const u = useAuthStore.getState().user;
    if (u && !u.onboarded) {
      setTimeout(() => setOnboardOpen(true), 300);
    }
  };

  // Global custom-event hook so any component can open the auth modal
  // by dispatching:  window.dispatchEvent(new CustomEvent('steami:openAuth'))
  useEffect(() => {
    const handler = () => setAuthOpen(true);
    window.addEventListener('steami:openAuth', handler);
    return () => window.removeEventListener('steami:openAuth', handler);
  }, []);

  const openSubscribeModal = () => {
    setNlMode('subscribe');
    setNlOpen(true);
    closeMenu();
  };

  const closeNlModal = () => {
    setNlOpen(false);
    nlPopup.dismiss();
  };

  // ── Shared styles ───────────────────────────────────────────────────────────
  const btnStyle = {
    border: `1px solid ${isLight ? 'rgba(147,197,253,0.4)' : 'rgba(99,179,237,0.18)'}`,
    background: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(10,25,55,0.4)',
    backdropFilter: 'blur(8px)',
  };

  const menuItemStyle = {
    borderColor: isLight ? 'rgba(147,197,253,0.2)' : 'rgba(111,168,255,0.1)',
  };

  const notifPanelStyle = {
    background:     isLight ? 'rgba(255,255,255,0.95)' : 'rgba(5,15,40,0.96)',
    border:         `1px solid ${isLight ? 'rgba(147,197,253,0.4)' : 'rgba(99,179,237,0.14)'}`,
    backdropFilter: 'blur(24px) saturate(200%)',
    boxShadow:      isLight
      ? '0 8px 40px rgba(0,180,255,0.12)'
      : '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,217,255,0.06)',
  } as React.CSSProperties;

  return (
    <>
      {/* ── Desktop nav bar ── */}
      <motion.nav
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center px-4 sm:px-6 md:px-8 gap-2 md:gap-4 transition-all duration-300 overflow-hidden"
        style={{
          background: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(3, 8, 20, 0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: isLight ? '1px solid rgba(147, 197, 253, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: isLight ? '0 1px 24px rgba(147, 197, 253, 0.15)' : '0 1px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── STEAMI logo — always navigates to landing page "/" ── */}
        <Link
          to="/"
          className="font-mono text-[18px] sm:text-[20px] font-bold tracking-wider group shrink-0"
          aria-label="STEAMI — Go to homepage"
        >
          <motion.span
            className="text-steami-gold inline-block drop-shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(232,184,75,0.4)] transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            STEAMI
          </motion.span>
        </Link>

        {/* Desktop nav links
            BUG FIX: when the user is admin the link list grows to 9 items
            (HOME + 5 public + DASHBOARD + MOD + ADMIN + API).  The old
            `gap-8` + `text-[16px]` combo is ~900 px wide, which pushes the
            right-side icons (bell, theme, avatar/login) completely off-screen
            on any viewport narrower than ~1280 px, including the dashboard
            view on tablets.

            Fix:
              • Container gets `flex-1 min-w-0 overflow-x-auto` so it takes
                whatever space remains AFTER the right controls and can scroll
                horizontally if it still overflows.
              • Each link gets `shrink-0 whitespace-nowrap` so labels don't
                wrap mid-word.
              • Font and gap are slightly tighter on md, full size on lg+.
        */}
        <div className="hidden md:flex items-center gap-3 lg:gap-5 ml-2 lg:ml-4 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {navLinks.map((link, i) => {
            const isActive = location.pathname === link.path;
            return (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.35 }}
                className="relative flex items-center h-full py-1 shrink-0"
              >
                <Link
                  to={link.path}
                  onClick={(e) => { if (isActive) e.preventDefault(); }}
                  className={`group relative font-mono text-[13px] lg:text-[15px] tracking-[0.08em] lg:tracking-[0.12em] uppercase whitespace-nowrap transition-colors duration-200 ease-in-out ${
                    isActive ? 'text-steami-cyan' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{link.label}</span>
                  <span
                    className={`absolute left-0 -bottom-1 h-[2px] bg-gradient-to-r from-steami-cyan to-steami-magenta transition-all duration-300 ease-out ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Right-side controls: shrink-0 + ml-auto keeps them pinned to the right
            and prevents the nav links from ever pushing them off-screen */}
        <div className="ml-auto flex items-center gap-2 lg:gap-4 shrink-0">

          {/* NEWSLETTER — Desktop Subscribe button */}
          <button
            onClick={openSubscribeModal}
            title="Subscribe to newsletter"
            className="hidden md:flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-steami-cyan transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Subscribe
          </button>

          {/* ── Notification Bell ─────────────────────────────────────────── */}
          <div className="relative hidden md:block" ref={notifPanelRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNotifOpen}
              className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:shadow-[0_0_15px_rgba(0,255,255,0.15)]"
              style={btnStyle}
              aria-label="Notifications"
            >
              <motion.div
                animate={notifLoading ? { rotate: [0, 15, -15, 0] } : {}}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              >
                <Bell
                  className="w-3.5 h-3.5"
                  style={{ color: notifUnread > 0 ? '#00d9ff' : (isLight ? '#64748b' : '#94a3b8') }}
                />
              </motion.div>

              <AnimatePresence>
                {notifUnread > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold text-black"
                    style={{ background: 'linear-gradient(135deg, #00d9ff, #ff4ef0)' }}
                  >
                    {notifUnread > 99 ? '99+' : notifUnread}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Notification dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  key="notif-panel"
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0,  scale: 1 }}
                  exit={{   opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                  className="absolute right-0 top-12 w-[340px] rounded-xl overflow-hidden z-50"
                  style={notifPanelStyle}
                >
                  {/* Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: isLight ? 'rgba(147,197,253,0.25)' : 'rgba(99,179,237,0.1)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5" style={{ color: '#00d9ff' }} />
                      <span className="font-mono text-[11px] tracking-widest uppercase"
                            style={{ color: isLight ? '#0f172a' : '#e2e8f0' }}>
                        Notifications
                      </span>
                      {notifItems.length > 0 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: isLight ? 'rgba(0,217,255,0.1)' : 'rgba(0,217,255,0.12)', color: '#00d9ff' }}>
                          {notifItems.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notifItems.length > 0 && (
                        <button
                          onClick={clearAllNotifs}
                          className="font-mono text-[9px] tracking-wider uppercase opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: isLight ? '#64748b' : '#94a3b8' }}
                        >
                          Clear all
                        </button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="opacity-40 hover:opacity-80 transition-opacity">
                        <X className="w-3 h-3" style={{ color: isLight ? '#0f172a' : '#e2e8f0' }} />
                      </button>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="max-h-[420px] overflow-y-auto">
                    {notifItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                        >
                          <Bell className="w-8 h-8 opacity-20" style={{ color: isLight ? '#0f172a' : '#e2e8f0' }} />
                        </motion.div>
                        <span className="font-mono text-[10px] tracking-widest uppercase opacity-30"
                              style={{ color: isLight ? '#0f172a' : '#e2e8f0' }}>
                          All caught up
                        </span>
                      </div>
                    ) : (
                      <ul>
                        {notifItems.map((item, idx) => {
                          const meta = TYPE_META[item.type] ?? TYPE_META.blog;
                          const Icon = meta.Icon;
                          return (
                            <motion.li
                              key={`${item.type}:${item.id}`}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04, duration: 0.22 }}
                            >
                              <Link
                                to={item.url}
                                onClick={() => setNotifOpen(false)}
                                className="flex items-start gap-3 px-4 py-3 group transition-all duration-150"
                                style={{ borderBottom: `1px solid ${isLight ? 'rgba(147,197,253,0.12)' : 'rgba(99,179,237,0.07)'}` }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isLight ? 'rgba(0,217,255,0.04)' : 'rgba(0,217,255,0.05)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                <div
                                  className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden mt-0.5"
                                  style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
                                >
                                  {item.image ? (
                                    <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg"
                                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : (
                                    <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-mono text-[8px] tracking-widest uppercase font-semibold" style={{ color: meta.color }}>
                                      New {meta.label}
                                    </span>
                                    {item.field && (
                                      <span className="font-mono text-[8px] tracking-wider uppercase opacity-50"
                                            style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                                        · {item.field}
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-mono text-[11px] leading-snug line-clamp-2 group-hover:opacity-100 transition-opacity"
                                     style={{ color: isLight ? '#0f172a' : '#e2e8f0', opacity: 0.85 }}>
                                    {item.title}
                                  </p>
                                  <span className="font-mono text-[9px] opacity-40 mt-1 block"
                                        style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                                    {formatRelative(item.created_at)}
                                  </span>
                                </div>

                                <ChevronRight className="w-3 h-3 shrink-0 mt-1 opacity-0 group-hover:opacity-40 transition-opacity"
                                              style={{ color: isLight ? '#0f172a' : '#e2e8f0' }} />
                              </Link>
                            </motion.li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {notifItems.length > 0 && (
                    <div className="px-4 py-2.5 flex items-center justify-center border-t"
                         style={{ borderColor: isLight ? 'rgba(147,197,253,0.18)' : 'rgba(99,179,237,0.08)' }}>
                      <span className="font-mono text-[9px] tracking-widest uppercase opacity-30"
                            style={{ color: isLight ? '#0f172a' : '#e2e8f0' }}>
                        Polling every 60s
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:shadow-[0_0_15px_rgba(0,255,255,0.15)]"
            style={btnStyle}
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isLight
                  ? <Moon className="w-3.5 h-3.5 text-muted-foreground" />
                  : <Sun className="w-3.5 h-3.5 text-steami-gold" />
                }
              </motion.div>
            </AnimatePresence>
          </motion.button>

          {diaryCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="hidden md:block"
            >
              <Link to="/dashboard" className="font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 rounded steami-badge-gold">
                {diaryCount} NOTES
              </Link>
            </motion.div>
          )}

          {/* User menu / Login */}
          <div className="hidden md:flex items-center relative">
            {isAuthenticated && user ? (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-200"
                  style={btnStyle}
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-steami-cyan/30 shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-steami-cyan/30 to-steami-magenta/30">
                        <span className="font-mono text-[9px] font-bold text-steami-cyan">
                          {getInitials(user.fullName ?? 'U')}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[11px] tracking-wider text-muted-foreground max-w-[80px] truncate hidden lg:block">
                    {formatShortUserName(user.fullName).toUpperCase()}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </motion.button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden py-2"
                      style={{
                        background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(8,16,38,0.95)',
                        backdropFilter: 'blur(24px)',
                        border: `1px solid ${isLight ? 'rgba(147,197,253,0.3)' : 'rgba(111,168,255,0.15)'}`,
                        boxShadow: isLight ? '0 12px 40px rgba(147,197,253,0.2)' : '0 12px 40px rgba(0,0,0,0.5)',
                      }}
                    >
                      <div className="px-4 py-2.5 border-b" style={menuItemStyle}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-steami-cyan/30 shrink-0">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-steami-cyan/30 to-steami-magenta/30">
                                <span className="font-mono text-[10px] font-bold text-steami-cyan">
                                  {getInitials(user.fullName ?? 'U')}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] text-foreground font-semibold truncate">{formatShortUserName(user.fullName)}</p>
                            <p className="font-mono text-[10px] text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                      >
                        <User className="w-3.5 h-3.5" /> My Profile
                      </Link>

                      <div className="my-1 border-t" style={menuItemStyle} />

                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAuthOpen(true)}
                className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase px-3.5 py-2 rounded-md transition-all duration-200 text-muted-foreground hover:text-steami-cyan hover:shadow-[0_0_15px_rgba(0,255,255,0.15)]"
                style={btnStyle}
              >
                <LogIn className="w-3.5 h-3.5" /> LOGIN
              </motion.button>
            )}
          </div>

          {/* Hamburger — mobile */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden relative w-8 h-8 flex items-center justify-center focus:outline-none"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className="sr-only">{menuOpen ? 'Close' : 'Menu'}</span>
            <span className="block absolute w-5 transition-all duration-300 ease-in-out" style={{ height: 14 }}>
              <span className="block absolute h-[2px] w-5 rounded-full bg-foreground transition-all duration-300"
                style={{ top: menuOpen ? 6 : 0, transform: menuOpen ? 'rotate(45deg)' : 'rotate(0)' }} />
              <span className="block absolute top-[6px] h-[2px] w-5 rounded-full bg-foreground transition-all duration-300"
                style={{ opacity: menuOpen ? 0 : 1 }} />
              <span className="block absolute h-[2px] w-5 rounded-full bg-foreground transition-all duration-300"
                style={{ top: menuOpen ? 6 : 12, transform: menuOpen ? 'rotate(-45deg)' : 'rotate(0)' }} />
            </span>
          </button>
        </div>
      </motion.nav>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[49]"
              style={{ background: isLight ? 'rgba(186, 230, 253, 0.4)' : 'rgba(0,0,0,0.6)' }}
              onClick={closeMenu}
            />
            <motion.div
              key="panel"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed top-0 right-0 bottom-0 z-[51] w-full max-w-xs flex flex-col pt-16 px-4 sm:px-6 pb-6 sm:pb-8 overflow-y-auto"
              style={{
                background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(10, 18, 42, 0.97)',
                backdropFilter: 'blur(24px) saturate(160%)',
                borderLeft: isLight ? '1px solid rgba(147, 197, 253, 0.3)' : '1px solid rgba(111, 168, 255, 0.1)',
                boxShadow: isLight ? '-8px 0 40px rgba(147, 197, 253, 0.15)' : '-8px 0 40px rgba(0,0,0,0.5)',
              }}
            >
              {/* Mobile user identity block */}
              {isAuthenticated && user && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="mb-4 pb-4 border-b flex items-center gap-3"
                  style={{ borderColor: isLight ? 'rgba(147,197,253,0.2)' : 'rgba(111,168,255,0.1)' }}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-steami-cyan/30 shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-steami-cyan/30 to-steami-magenta/30">
                        <span className="font-mono text-[11px] font-bold text-steami-cyan">
                          {getInitials(user.fullName ?? 'U')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] text-foreground font-semibold truncate">{formatShortUserName(user.fullName)}</p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                </motion.div>
              )}

              {/* Nav links */}
              <div className="flex flex-col gap-1">

                {navLinks.map((link, i) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <motion.div
                      key={link.path}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.14 + i * 0.06, duration: 0.3 }}
                    >
                      <Link
                        to={link.path}
                        onClick={(e) => {
                          if (isActive) e.preventDefault();
                          closeMenu();
                        }}
                        className={`block font-mono text-[15px] sm:text-[17px] tracking-[0.08em] sm:tracking-[0.12em] uppercase py-2.5 px-3 rounded-lg transition-colors break-words ${
                          isActive ? 'text-steami-cyan bg-accent/10' : 'text-foreground/70 hover:text-foreground hover:bg-accent/5'
                        }`}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}

                {/* Profile link — mobile (only when authenticated) */}
                {isAuthenticated && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14 + navLinks.length * 0.06, duration: 0.3 }}
                  >
                    <Link
                      to="/profile"
                      onClick={closeMenu}
                      className={`flex items-center gap-2 font-mono text-[15px] sm:text-[17px] tracking-[0.08em] sm:tracking-[0.12em] uppercase py-2.5 px-3 rounded-lg transition-colors ${
                        location.pathname === '/profile'
                          ? 'text-steami-cyan bg-accent/10'
                          : 'text-foreground/70 hover:text-foreground hover:bg-accent/5'
                      }`}
                    >
                      <User className="w-4 h-4" /> PROFILE
                    </Link>
                  </motion.div>
                )}
              </div>

              <div className="my-5 h-px bg-border/30" />

              {diaryCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                >
                  <Link to="/dashboard" onClick={closeMenu} className="font-mono text-[10px] tracking-wider uppercase px-3 py-2 rounded steami-badge-gold inline-block">
                    {diaryCount} NOTES
                  </Link>
                </motion.div>
              )}

              <motion.div
                className="mt-auto flex flex-col gap-3 pt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                {isAuthenticated && user ? (
                  <button
                    onClick={() => { logout(); closeMenu(); }}
                    className="w-full font-mono text-[11px] tracking-wider uppercase px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                    style={{
                      border: isLight ? '1px solid rgba(252,92,101,0.3)' : '1px solid rgba(252,92,101,0.2)',
                      background: isLight ? 'rgba(252,92,101,0.06)' : 'rgba(252,92,101,0.08)',
                      color: 'hsl(var(--steami-red, 0 85% 65%))',
                    }}
                  >
                    <LogOut className="w-3.5 h-3.5" /> SIGN OUT
                  </button>
                ) : (
                  <button
                    onClick={() => { closeMenu(); setTimeout(() => setAuthOpen(true), 200); }}
                    className="w-full font-mono text-[11px] tracking-wider uppercase px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                    style={{
                      border: isLight ? '1px solid rgba(147, 197, 253, 0.4)' : '1px solid rgba(99, 179, 237, 0.18)',
                      background: isLight ? 'rgba(224, 242, 254, 0.5)' : 'rgba(10, 25, 55, 0.4)',
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    <LogIn className="w-3.5 h-3.5" /> LOGIN
                  </button>
                )}

                <button
                  onClick={toggleTheme}
                  className="w-full font-mono text-[11px] tracking-wider uppercase px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                  style={{
                    border: isLight ? '1px solid rgba(147, 197, 253, 0.4)' : '1px solid rgba(99, 179, 237, 0.18)',
                    background: isLight ? 'rgba(224, 242, 254, 0.5)' : 'rgba(10, 25, 55, 0.4)',
                    color: 'hsl(var(--muted-foreground))',
                  }}
                >
                  {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  {isLight ? 'DARK MODE' : 'LIGHT MODE'}
                </button>

                <button
                  onClick={openSubscribeModal}
                  className="w-full font-mono text-[11px] tracking-wider uppercase px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                  style={{
                    border: isLight ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(0,217,255,0.2)',
                    background: isLight ? 'rgba(0,217,255,0.06)' : 'rgba(0,217,255,0.08)',
                    color: 'hsl(var(--steami-cyan))',
                  }}
                >
                  <Mail className="w-3.5 h-3.5" /> SUBSCRIBE
                </button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />
      <OnboardingModal open={onboardOpen} onClose={() => setOnboardOpen(false)} />

      <NewsletterModal
        mode={nlOpen ? nlMode : null}
        initialEmail={nlPopup.email}
        onClose={closeNlModal}
      />
    </>
  );
}
