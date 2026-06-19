import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SteamiLayout } from '@/components/SteamiLayout';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { RequireLogin } from '@/components/RequireLogin';
import { api } from '@/lib/api';
import { fadeInUp } from '@/lib/motion';
import {
  User, Mail, Lock, MapPin, Globe, Briefcase, FileText,
  Camera, Trash2, Save, Eye, EyeOff, CheckCircle, AlertCircle,
  Shield, LogOut, Sparkles, ChevronRight, X, Atom,
  GraduationCap, FlaskConical,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  uid: string;
  full_name: string;
  username?: string;
  email: string;
  bio?: string;
  location?: string;
  website?: string;
  profession?: string;
  avatar_url?: string;
  google_picture?: string;   // Google OAuth profile photo fallback
  auth_provider?: string;    // "google" | "email" — controls which sections to show
  interests?: string[];
  role?: string;
  subscribe_email?: boolean;
  created_at?: string;
}

// ── Avatar Presets ─────────────────────────────────────────────────────────────
//
// ✅ ALL URLs validated against the backend _validate_avatar_url logic:
//    path.endswith('.png') BEFORE the '?' query string → always accepted.
//
// robohash.org sets:
//   set1 → colourful cartoon robots   (great for scientists — energetic)
//   set2 → monsters / aliens          (fun, quirky)
//   set3 → clean robot heads          (professional, minimal)
//   set4 → cats
//   set5 → human silhouettes          (most professional-looking)
//   bgset=bg1 → space/geo backgrounds
//   bgset=bg2 → real photo backgrounds (more realistic feel)

const robo = (seed: string, set: number, bg?: string) =>
  `https://robohash.org/${encodeURIComponent(seed)}.png?set=set${set}&size=200x200${bg ? `&bgset=${bg}` : ''}`;

const AVATAR_CATEGORIES = [
  {
    label: 'Scientists',
    icon: FlaskConical,
    avatars: [
      { label: 'Marie (Physicist)',    url: robo('marie-curie-physicist',    1, 'bg1') },
      { label: 'Albert (Theorist)',    url: robo('albert-einstein-theorist', 3, 'bg1') },
      { label: 'Rosalind (Biologist)', url: robo('rosalind-franklin-bio',    5, 'bg2') },
      { label: 'Nikola (Inventor)',    url: robo('nikola-tesla-inventor',    1, 'bg2') },
      { label: 'Carl (Astronomer)',    url: robo('carl-sagan-cosmos',        3, 'bg1') },
      { label: 'Dmitri (Chemist)',     url: robo('dmitri-mendeleev-chem',    2, 'bg1') },
      { label: 'Vera (Astrophysics)',  url: robo('vera-rubin-astro',         5, 'bg1') },
      { label: 'Alan (Computing)',     url: robo('alan-turing-computing',    3, 'bg2') },
      { label: 'Ada (Algorithms)',     url: robo('ada-lovelace-algorithm',   1, 'bg1') },
    ],
  },
  {
    label: 'Students',
    icon: GraduationCap,
    avatars: [
      { label: 'Priya (STEM)',         url: robo('priya-sharma-stem',       5, 'bg2') },
      { label: 'Kai (CS Major)',       url: robo('kai-chen-cs-major',       3, 'bg1') },
      { label: 'Amara (Medicine)',     url: robo('amara-osei-medicine',     5, 'bg1') },
      { label: 'Luca (PhD)',           url: robo('luca-romano-phd',         3, 'bg2') },
      { label: 'Yuki (Research)',      url: robo('yuki-tanaka-research',    1, 'bg1') },
      { label: 'Omar (Graduate)',      url: robo('omar-hassan-graduate',    5, 'bg2') },
      { label: 'Zara (Data Sci)',      url: robo('zara-ali-data-science',   3, 'bg1') },
      { label: 'Dev (Engineering)',    url: robo('dev-patel-engineering',   1, 'bg2') },
      { label: 'Sofia (Math)',         url: robo('sofia-reyes-mathematics', 5, 'bg1') },
    ],
  },
  {
    label: 'Professionals',
    icon: Briefcase,
    avatars: [
      { label: 'Sasha (Tech Lead)',    url: robo('sasha-petrov-tech-lead',  3, 'bg1') },
      { label: 'Jordan (Data Sci)',    url: robo('jordan-lee-data-sci',     5, 'bg1') },
      { label: 'Nadia (AI Eng)',       url: robo('nadia-kaur-ai-engineer',  3, 'bg2') },
      { label: 'Marcus (PM)',          url: robo('marcus-webb-product-mgr', 5, 'bg2') },
      { label: 'Elena (Analyst)',      url: robo('elena-sousa-analyst',     3, 'bg1') },
      { label: 'Rafael (Consultant)',  url: robo('rafael-mendez-consult',   1, 'bg1') },
      { label: 'Chen (Researcher)',    url: robo('chen-wei-researcher',     5, 'bg1') },
      { label: 'Aisha (Engineer)',     url: robo('aisha-bello-engineer',    3, 'bg2') },
      { label: 'Ivan (Architect)',     url: robo('ivan-kozlov-architect',   1, 'bg2') },
    ],
  },
];

// ── Small helpers ─────────────────────────────────────────────────────────────

// Strip HTML/XML tags from user-supplied text before saving to the backend.
// This prevents stored-XSS payloads (e.g. <img src=x onerror=...>) from
// ever reaching the database or being re-rendered anywhere in the app.
function sanitizeBio(raw: string): string {
  return raw.replace(/<[^>]*>/g, '').trim();
}

const getInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const PROFESSION_ACCENT: Record<string, string> = {
  scientist: 'steami-cyan',
  student: 'steami-magenta',
  researcher: 'steami-cyan',
  engineer: 'steami-gold',
  default: 'steami-violet',
};

function professionAccent(profession?: string) {
  if (!profession) return 'text-steami-violet';
  const key = Object.keys(PROFESSION_ACCENT).find((k) => profession.toLowerCase().includes(k));
  return `text-${PROFESSION_ACCENT[key ?? 'default']}`;
}

// ── Toast mini ────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className={`fixed bottom-6 right-6 z-[999] flex items-center gap-3 px-5 py-3 rounded-xl font-mono text-[13px] shadow-2xl
        ${type === 'success' ? 'border border-steami-cyan/30 text-steami-cyan bg-background/90' : 'border border-red-400/30 text-red-400 bg-background/90'}`}
      style={{ backdropFilter: 'blur(20px)' }}
    >
      {type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
    </motion.div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card relative p-6 overflow-hidden"
    >
      <div className="steami-section-label mb-5">{title}</div>
      {children}
    </motion.div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

function Field({
  label, icon: Icon, value, onChange, placeholder, type = 'text', disabled,
}: {
  label: string; icon: React.ElementType; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent border border-border/40 rounded-lg pl-9 pr-4 py-2.5 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-steami-cyan/50 transition-colors disabled:opacity-50"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const isLight = theme === 'light';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // form fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [profession, setProfession] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // security
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // avatar picker modal
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [activeAvatarCategory, setActiveAvatarCategory] = useState(0);

  // ui state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch profile
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    api.profile
      .me()
      .then((data) => {
        const p = data as UserProfile;
        setProfile(p);
        setFullName(p.full_name ?? '');
        setUsername(p.username ?? '');
        setBio(p.bio ?? '');
        setLocation(p.location ?? '');
        setWebsite(p.website ?? '');
        setProfession(p.profession ?? '');
        // Prefer custom avatar_url; fall back to Google profile picture for OAuth users
        setAvatarUrl(p.avatar_url ?? p.google_picture ?? '');
      })
      .catch(() => showToast('Failed to load profile', 'error'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <SteamiLayout>
        <RequireLogin message="Please login to view and manage your profile." />
      </SteamiLayout>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Only send fields that are non-empty (avoids 400 "no fields to update" / empty string validation errors)
      const updates: Record<string, string> = {};
      if (fullName.trim())   updates.full_name  = fullName.trim();
      if (username.trim())   updates.username   = username.trim();
      // Sanitize bio: strip any HTML tags before saving to prevent stored-XSS
      if (bio.trim())        updates.bio        = sanitizeBio(bio);
      if (location.trim())   updates.location   = location.trim();
      if (website.trim())    updates.website    = website.trim();
      if (profession.trim()) updates.profession = profession.trim();

      if (Object.keys(updates).length === 0) {
        showToast('No changes to save', 'error');
        return;
      }

      await api.profile.update(updates);
      setProfile((p) => p ? { ...p, ...updates } : p);
      showToast('Profile updated successfully');
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetAvatar = async (url: string) => {
    setSaving(true);
    try {
      await api.profile.setAvatar(url);
      setAvatarUrl(url);
      setProfile((p) => p ? { ...p, avatar_url: url } : p);
      setAvatarModalOpen(false);
      showToast('Avatar updated');
    } catch {
      showToast('Failed to set avatar — URL must end in .jpg/.png/.webp or be from a trusted host (Imgur, GitHub…)', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await api.profile.removeAvatar();
      setAvatarUrl('');
      setProfile((p) => p ? { ...p, avatar_url: undefined } : p);
      showToast('Avatar removed');
    } catch {
      showToast('Failed to remove avatar', 'error');
    }
  };

  const handleCustomAvatarSet = async () => {
    if (!customAvatarUrl.trim()) return;
    await handleSetAvatar(customAvatarUrl.trim());
    setCustomAvatarUrl('');
  };

  const handleChangePassword = async () => {
    if (profile?.auth_provider === 'google') {
      showToast('Google accounts do not use a password', 'error'); return;
    }
    if (newPw !== confirmPw) { showToast('Passwords do not match', 'error'); return; }
    if (newPw.length < 8) { showToast('Password must be ≥8 chars with uppercase, lowercase and digit', 'error'); return; }
    setSaving(true);
    try {
      await api.profile.changePassword({ current_password: currentPw, new_password: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password changed successfully');
    } catch {
      showToast('Failed to change password — check current password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.includes('@')) { showToast('Enter a valid email', 'error'); return; }
    setSaving(true);
    try {
      await api.profile.changeEmail({ new_email: newEmail, current_password: emailPw });
      setNewEmail(''); setEmailPw('');
      showToast('Email updated — please log in again');
    } catch {
      showToast('Failed to change email — check password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (profile?.auth_provider === 'google') {
      showToast('Google accounts cannot be deleted here — contact support', 'error'); return;
    }
    if (!deletePw) { showToast('Enter your password to confirm', 'error'); return; }
    setSaving(true);
    try {
      await api.profile.deleteAccount(deletePw);
      logout();
      navigate('/');
    } catch {
      showToast('Failed to delete account — check password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(profile?.full_name ?? user?.fullName ?? 'U');

  return (
    <SteamiLayout>
      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast.message} type={toast.type} />}
      </AnimatePresence>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {avatarModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80]"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
              onClick={() => setAvatarModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ duration: 0.22 }}
              className="fixed z-[81] inset-x-4 top-[8vh] bottom-[8vh] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[700px] rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(8,16,38,0.97)',
                border: isLight ? '1px solid rgba(147,197,253,0.3)' : '1px solid rgba(111,168,255,0.15)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
              }}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: isLight ? 'rgba(147,197,253,0.2)' : 'rgba(111,168,255,0.1)' }}>
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">AVATAR PICKER</p>
                  <h2 className="font-semibold text-foreground text-[16px] mt-0.5">
                    {saving ? '⏳ Uploading avatar…' : 'Choose your professional avatar'}
                  </h2>
                </div>
                <button
                  onClick={() => !saving && setAvatarModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent/10 disabled:opacity-40"
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Category tabs */}
              <div className="flex gap-1 px-6 pt-4 shrink-0">
                {AVATAR_CATEGORIES.map((cat, i) => {
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.label}
                      onClick={() => setActiveAvatarCategory(i)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[11px] tracking-wider uppercase transition-all ${
                        activeAvatarCategory === i
                          ? 'bg-steami-cyan/15 text-steami-cyan border border-steami-cyan/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/10 border border-transparent'
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Avatar grid */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-3 gap-4">
                  {AVATAR_CATEGORIES[activeAvatarCategory].avatars.map((av) => (
                    <motion.button
                      key={av.label}
                      whileHover={saving ? {} : { scale: 1.04 }}
                      whileTap={saving ? {} : { scale: 0.96 }}
                      onClick={() => !saving && handleSetAvatar(av.url)}
                      disabled={saving}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group relative ${
                        avatarUrl === av.url
                          ? 'border-steami-cyan/60 bg-steami-cyan/10'
                          : 'border-border/30 hover:border-steami-cyan/30 hover:bg-accent/5'
                      } ${saving ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-border/30 group-hover:ring-steami-cyan/40 transition-all">
                        <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                      </div>
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground group-hover:text-foreground text-center leading-tight">
                        {av.label}
                      </span>
                      {avatarUrl === av.url && (
                        <span className="absolute top-2 right-2"><CheckCircle className="w-3 h-3 text-steami-cyan" /></span>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Custom URL input */}
                <div className="mt-6 pt-5 border-t" style={{ borderColor: isLight ? 'rgba(147,197,253,0.2)' : 'rgba(111,168,255,0.1)' }}>
                  <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">OR PASTE CUSTOM URL</p>
                  <p className="font-mono text-[10px] text-muted-foreground/60 mb-2">
                    Must end in <span className="text-steami-cyan">.jpg .png .webp .gif</span> or be from Imgur / GitHub / Cloudinary
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customAvatarUrl}
                      onChange={(e) => setCustomAvatarUrl(e.target.value)}
                      placeholder="https://i.imgur.com/abc123.jpg"
                      className="flex-1 bg-transparent border border-border/40 rounded-lg px-3 py-2 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-steami-cyan/50 transition-colors"
                    />
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={handleCustomAvatarSet}
                      className="steami-btn steami-btn-cyan text-[11px] px-4 shrink-0"
                    >
                      SET
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Page header */}
      <motion.div className="mb-8" variants={fadeInUp} initial="hidden" animate="visible">
        <h1 className="steami-heading text-3xl md:text-4xl mb-3">Your Profile</h1>
        <p className="text-[18px] font-medium text-muted-foreground max-w-xl leading-relaxed">
          Manage your identity, security, and account preferences.
        </p>
      </motion.div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 space-y-4 animate-pulse">
              {[80, 60, 70, 50].map((w, j) => (
                <div key={j} className="h-3 bg-muted/40 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Avatar + Identity Card ── */}
          <Section title="IDENTITY" delay={0.05}>
            <div className="flex flex-col sm:flex-row gap-6 items-start">

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-border/40 group-hover:ring-steami-cyan/40 transition-all">
                    {(avatarUrl || profile?.google_picture) ? (
                      <img src={avatarUrl || profile?.google_picture} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-steami-cyan/20 to-steami-magenta/20">
                        <span className="font-mono text-2xl font-bold text-steami-cyan">{initials}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 flex gap-1">
                    {profile?.role && (
                      <span className={`steami-badge text-[9px] ${profile.role === 'admin' ? 'steami-badge-gold' : profile.role === 'mod' ? 'steami-badge-cyan' : 'steami-badge-violet'}`}>
                        {profile.role.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Avatar actions */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setAvatarModalOpen(true)}
                    className="steami-btn text-[10px] py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Camera className="w-3 h-3" /> CHANGE
                  </motion.button>
                  {avatarUrl && (
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={handleRemoveAvatar}
                      className="steami-btn text-[10px] py-1.5 px-3 flex items-center gap-1.5"
                      style={{ borderColor: 'rgba(252,92,101,0.3)', color: 'hsl(var(--steami-red))' }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </motion.button>
                  )}
                </div>

                {/* Profession badge */}
                {profile?.profession && (
                  <div className={`flex items-center gap-1.5 font-mono text-[11px] font-medium ${professionAccent(profile.profession)}`}>
                    <Atom className="w-3 h-3" />
                    {profile.profession}
                  </div>
                )}

                {profile?.created_at && (
                  <p className="font-mono text-[10px] text-muted-foreground text-center">
                    Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Profile fields */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <Field label="Full Name" icon={User} value={fullName} onChange={setFullName} placeholder="Your name" />
                <Field label="Username" icon={User} value={username} onChange={setUsername} placeholder="username_123" />
                <div className="sm:col-span-2">
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1.5">BIO</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell the STEAMI community about yourself..."
                      rows={3}
                      className="w-full bg-transparent border border-border/40 rounded-lg pl-9 pr-4 py-2.5 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-steami-cyan/50 transition-colors resize-none"
                    />
                  </div>
                </div>
                <Field label="Location" icon={MapPin} value={location} onChange={setLocation} placeholder="City, Country" />
                <Field label="Profession" icon={Briefcase} value={profession} onChange={setProfession} placeholder="e.g. PhD Researcher" />
                <div className="sm:col-span-2">
                  <Field label="Website" icon={Globe} value={website} onChange={setWebsite} placeholder="https://yoursite.com" />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleSaveProfile}
                disabled={saving}
                className="steami-btn steami-btn-cyan text-[11px] flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'SAVING...' : 'SAVE PROFILE'}
              </motion.button>
            </div>
          </Section>

          {/* ── Security: Change Password ── */}
          <Section title="CHANGE PASSWORD" delay={0.1}>
            {profile?.auth_provider === 'google' ? (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-steami-gold/20 bg-steami-gold/5">
                <Shield className="w-4 h-4 text-steami-gold shrink-0" />
                <p className="font-mono text-[12px] text-muted-foreground">
                  Your account uses <span className="text-steami-gold font-semibold">Google Sign-In</span>. Password management is handled by Google.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Current Password" icon={Lock} value={currentPw} onChange={setCurrentPw} type="password" placeholder="••••••••" />
                  <Field label="New Password" icon={Lock} value={newPw} onChange={setNewPw} type="password" placeholder="••••••••" />
                  <Field label="Confirm New Password" icon={Lock} value={confirmPw} onChange={setConfirmPw} type="password" placeholder="••••••••" />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground mt-2">
                  Min. 8 chars · must include uppercase, lowercase and a digit.
                </p>
                <div className="mt-4 flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={handleChangePassword}
                    disabled={saving || !currentPw || !newPw || !confirmPw}
                    className="steami-btn text-[11px] flex items-center gap-2 px-5 py-2.5 disabled:opacity-40"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    UPDATE PASSWORD
                  </motion.button>
                </div>
              </>
            )}
          </Section>

          {/* ── Security: Change Email ── */}
          <Section title="CHANGE EMAIL" delay={0.15}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="New Email Address" icon={Mail} value={newEmail} onChange={setNewEmail} placeholder="newemail@example.com" />
              <Field label="Current Password" icon={Lock} value={emailPw} onChange={setEmailPw} type="password" placeholder="Confirm identity" />
            </div>
            <div className="mt-4 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleChangeEmail}
                disabled={saving || !newEmail || !emailPw}
                className="steami-btn text-[11px] flex items-center gap-2 px-5 py-2.5 disabled:opacity-40"
              >
                <Mail className="w-3.5 h-3.5" />
                UPDATE EMAIL
              </motion.button>
            </div>
          </Section>

          {/* ── Danger Zone ── */}
          <Section title="DANGER ZONE" delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <p className="font-medium text-[14px] text-foreground">Delete Account</p>
                <p className="font-mono text-[12px] text-muted-foreground mt-1">
                  Permanently delete your account. This is irreversible.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowDeleteConfirm((v) => !v)}
                className="steami-btn text-[11px] shrink-0 px-4 py-2.5 flex items-center gap-2"
                style={{ borderColor: 'rgba(252,92,101,0.3)', color: 'hsl(var(--steami-red))' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                DELETE MY ACCOUNT
              </motion.button>
            </div>

            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 pt-5 border-t border-red-400/20 flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                      <Field label="Confirm with your password" icon={Lock} value={deletePw} onChange={setDeletePw} type="password" placeholder="••••••••" />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={handleDeleteAccount}
                      disabled={saving || !deletePw}
                      className="steami-btn text-[11px] px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 shrink-0"
                      style={{ borderColor: 'rgba(252,92,101,0.5)', color: 'hsl(var(--steami-red))', background: 'rgba(252,92,101,0.08)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      CONFIRM DELETE
                    </motion.button>
                  </div>
                  <p className="font-mono text-[11px] text-red-400/70 mt-2">
                    ⚠ This will permanently delete your account and all data. Cannot be undone.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sign out shortcut */}
            <div className="mt-6 pt-5 border-t" style={{ borderColor: 'rgba(111,168,255,0.1)' }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { logout(); navigate('/'); }}
                className="flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors group"
              >
                <LogOut className="w-3.5 h-3.5" />
                SIGN OUT
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
              </motion.button>
            </div>
          </Section>

          {/* ── Quick links ── */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="glass-card p-5 flex items-center gap-3"
          >
            <Sparkles className="w-4 h-4 text-steami-gold shrink-0" />
            <p className="font-mono text-[12px] text-muted-foreground flex-1">
              Manage your scientific interests to get personalised content recommendations.
            </p>
            <a href="/interests" className="steami-btn steami-btn-gold text-[10px] px-3 py-1.5 shrink-0">
              MANAGE INTERESTS
            </a>
          </motion.div>

        </div>
      )}
    </SteamiLayout>
  );
}