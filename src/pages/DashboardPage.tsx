import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SteamiLayout } from '@/components/SteamiLayout';
import { useSteamiStore } from '@/stores/steami-store';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { Link } from 'react-router-dom';
import { staggerContainer, cardVariants, cardHover, fadeInUp } from '@/lib/motion';
import {
  Trash2, ExternalLink, BookOpen, Sparkles, BarChart3, Activity,
  TrendingUp, Zap, Clock, Flame, User, Bell, BellOff, Newspaper,
  Lightbulb, ChevronRight, Tag, Loader2,
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { explainers } from '@/data/explainers';
import { SubjectRadarChart } from '@/components/SubjectRadarChart';
import { api } from '@/lib/api';
import { RequireLogin } from '@/components/RequireLogin';
import { PopupLinkPill } from '@/components/PopupLinkPill';
import { formatShortUserName, getInitials } from '@/lib/user-display';

// ── Types ────────────────────────────────────────────────────────────────────

interface MostOpenedItem {
  popup_id: string;
  popup_title: string;
  popup_type: string;
  count: number;
}

interface RecentEvent {
  id: string;
  uid: string;
  popup_type: string;
  popup_id: string;
  popup_title: string;
  opened_at: string;
  date: string;
  hour: number;
}

interface InsightStats {
  total_insights: number;
  articles_with_insight: number;
  articles_total: number;
  generating: boolean;
}

interface DashboardStats {
  total_events: number;
  by_type: {
    explainer?: number;
    ai_insight?: number;
    research_article?: number;
    simulation?: number;
    [key: string]: number | undefined;
  };
  by_date: Record<string, number>;
  most_opened: MostOpenedItem[];
  recent: RecentEvent[];
  // new fields from updated dashboard.py
  interests: string[];
  insight_stats: InsightStats;
  diary_total: number;
}

interface UserProfile {
  uid: string;
  full_name?: string;
  display_name?: string;
  email?: string;
  profession?: string;
  bio?: string;
  avatar_url?: string;
  google_picture?: string;   // Google OAuth profile photo fallback
  auth_provider?: string;
  interests?: string[];
  subscribed_newsletter?: boolean;
  role?: string;
}

interface Article {
  id: string;
  title: string;
  short_summary?: string;
  description?: string;
  article_url?: string;
  url?: string;
  source?: string;
  topic?: string;
  matched_domains?: string[];
  published_at?: string;
  fetched_at?: string;
  has_insight?: boolean;
}

interface Insight {
  article_id: string;
  title: string;
  topic?: string;
  source?: string;
  article_url?: string;
  ai_insight?: {
    summary?: string;
    domain?: string;
    key_points?: string[];
    implications?: string;
  };
  created_at?: string;
}

interface RefreshCheckResponse {
  new_articles: number;   // actual field name from backend
  since_hours: number;
  articles: Article[];
}

// ── Security helpers ─────────────────────────────────────────────────────────
//
// The bio field is user-supplied text.  React escapes JSX by default, so a
// plain `{profile.bio}` renders the raw string and does NOT execute scripts.
// However the audit screenshot shows that someone stored
//   <img src=x onerror=alert('XSS_TEST')>
// as their bio value and it appeared literally in the UI — the risk is that
// if the value is ever used in a dangerouslySetInnerHTML context elsewhere,
// or if a future developer copies the pattern without thinking, it would fire.
//
// Defence-in-depth: strip HTML tags on the *display* side so no angle-bracket
// payload ever makes it into the rendered DOM, even as escaped text.
//
function sanitizeBio(raw: string): string {
  // Remove every HTML/XML tag (including exotic variants like </  or <!)
  return raw.replace(/<[^>]*>/g, '').trim();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  explainer: 'Explainer',
  ai_insight: 'AI Insight',
  research_article: 'Research',
  simulation: 'Simulation',
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  explainer: 'steami-badge-violet',
  ai_insight: 'steami-badge-cyan',
  research_article: 'steami-badge-gold',
  simulation: 'steami-badge-green',
};

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────


// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { diary, removeDiaryEntry, clearDiary } = useSteamiStore();
  const { user, isAuthenticated } = useAuthStore();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';

  const [feedFilter, setFeedFilter] = useState<'all' | 'article' | 'news' | 'explainer'>('all');

  // API state
  const [backendStats, setBackendStats]         = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading]         = useState(false);
  const [profile, setProfile]                   = useState<UserProfile | null>(null);
  const [interests, setInterests]               = useState<string[]>([]);
  const [forMeArticles, setForMeArticles]       = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading]   = useState(false);
  const [refreshCheck, setRefreshCheck]         = useState<RefreshCheckResponse | null>(null);
  const [recentInsights, setRecentInsights]     = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading]   = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Dashboard activity summary + interests + insight_stats + diary_total
    //    GET /api/dashboard/me
    setStatsLoading(true);
    api.dashboard
      .me()
      .then((data) => setBackendStats(data as DashboardStats))
      .catch(() => undefined)
      .finally(() => setStatsLoading(false));

    // 2. Full profile (avatar, bio, profession, newsletter, role)
    //    GET /api/profile/me — confirmed to return { user: { avatar_url, ... } }
    api.profile
      .me()
      .then((data: any) => {
        const p = data?.user ?? data;
        setProfile(p as UserProfile);
      })
      .catch(() => undefined);

    // 3. Interests — GET /api/auth/interests (authoritative separate call)
    api.auth
      .getInterests()
      .then((data: any) => {
        const topics: string[] = Array.isArray(data?.topics)
          ? data.topics
          : Array.isArray(data) ? data : [];
        setInterests(topics);
      })
      .catch(() => undefined);

    // 4. Personalized articles feed — GET /api/articles/for-me
    setArticlesLoading(true);
    api.articles
      .forMe()
      .then((data: any) => {
        const list: Article[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.articles) ? data.articles : [];
        setForMeArticles(list);
      })
      .catch(() => undefined)
      .finally(() => setArticlesLoading(false));

    // 5. New articles badge — GET /api/articles/refresh/check
    api.articles
      .refreshCheck(24)
      .then((data) => setRefreshCheck(data as RefreshCheckResponse))
      .catch(() => undefined);

    // 6. Recent insights — GET /api/insights
    setInsightsLoading(true);
    api.insights
      .list()
      .then((data: any) => {
        const list: Insight[] = Array.isArray(data?.insights) ? data.insights : [];
        setRecentInsights(list.slice(0, 24));
      })
      .catch(() => undefined)
      .finally(() => setInsightsLoading(false));
  }, [isAuthenticated]);

  // GET /api/newsletter/recipients is public — runs for ALL authenticated users
  useEffect(() => {
    const emailToCheck = profile?.email ?? user?.email;
    if (!isAuthenticated || !emailToCheck) return;
    api.newsletter
      .recipients()
      .then((data: any) => {
        const recipients: any[] = Array.isArray(data) ? data : data?.recipients ?? data?.subscribers ?? [];
        // Truly subscribed = record found + subscribed===true + is_active not explicitly false
        const match = recipients.find(
          (entry) => String(entry.email ?? entry).toLowerCase() === emailToCheck.toLowerCase(),
        );
        const isSubscribed = !!match && match.subscribed === true && match.is_active !== false;
        setProfile((prev) => prev ? { ...prev, subscribed_newsletter: isSubscribed } : prev);
      })
      .catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, profile?.email, user?.email]);

  const toggleNewsletter = async () => {
    const email = profile?.email ?? user?.email;
    if (!email) {
      setNewsletterMessage('Add an email to subscribe.');
      return;
    }

    const nextSubscribed = !profile?.subscribed_newsletter;
    setNewsletterLoading(true);
    setNewsletterMessage('');
    try {
      if (nextSubscribed) {
        // POST /api/newsletter/subscribe — body: { email: string, name?: string }
        await api.newsletter.subscribe({
          email,
          name: profile?.display_name ?? profile?.full_name ?? user?.fullName ?? '',
        });
      } else {
        // POST /api/newsletter/unsubscribe — body: { email: string }
        await api.newsletter.unsubscribe({ email });
      }
      setProfile((prev) => prev ? { ...prev, subscribed_newsletter: nextSubscribed } : prev);
      setNewsletterMessage(nextSubscribed ? 'Subscribed to newsletter!' : 'Unsubscribed from newsletter.');
    } catch (err: any) {
      // Surface FastAPI 422 detail[] into a readable string
      const detail = err?.detail ?? err?.response?.data?.detail;
      const humanMsg = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : typeof detail === 'string'
          ? detail
          : err?.message ?? 'Newsletter update failed. Please try again.';
      setNewsletterMessage(humanMsg);
    } finally {
      setNewsletterLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SteamiLayout>
        <RequireLogin message="Please login first to view your dashboard and saved research diary." />
      </SteamiLayout>
    );
  }

  // Authoritative interest order: dedicated /interests call → dashboard.me → profile → auth store
  const userInterests =
    interests.length > 0
      ? interests
      : (backendStats?.interests ?? profile?.interests ?? user?.interests ?? []);

  // Personalized explainer cards from local data
  const personalizedExplainers = userInterests.length > 0
    ? explainers.filter((e) => userInterests.includes(e.field)).slice(0, 4)
    : [];

  // Diary count — dashboard.me provides it directly now
  const totalNotes = backendStats?.diary_total ?? diary.length;
  const fields     = [...new Set(diary.map((d) => d.field).filter(Boolean))].length;

  // 7-day heatmap
  const last7Days: { date: string; count: number }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    return { date: key, count: backendStats?.by_date?.[key] ?? 0 };
  });
  const maxDayCount = Math.max(...last7Days.map((d) => d.count), 1);

  // By-type breakdown
  const byType = backendStats?.by_type ?? {};
  const typeBreakdown = Object.entries(byType)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([type, count]) => ({ type, count: count ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // Feed filter
  const filteredArticles = feedFilter === 'all'
    ? forMeArticles
    : forMeArticles.filter((a) => {
        const domains = (a.matched_domains ?? []).map((d) => d.toLowerCase());
        if (feedFilter === 'article')   return !domains.includes('news');
        if (feedFilter === 'news')      return domains.includes('news');
        if (feedFilter === 'explainer') return domains.includes('explainer');
        return true;
      });

  // Insight stats from dashboard.me
  const insightStats = backendStats?.insight_stats;
  const displayedInsights = (() => {
    if (recentInsights.length === 0) return [];
    if (userInterests.length === 0) return recentInsights.slice(0, 2);

    const normalizedInterests = userInterests.map((interest) => interest.toLowerCase());
    const counts = new Map<string, number>();

    return recentInsights
      .filter((insight) => {
        const topic = insight.topic?.toLowerCase() ?? '';
        const domain = insight.ai_insight?.domain?.toLowerCase() ?? '';
        const match = normalizedInterests.find((key) => topic.includes(key) || domain.includes(key));
        const bucket = match ?? topic ?? domain ?? 'other';
        const current = counts.get(bucket) ?? 0;

        if (current >= 2) return false;
        counts.set(bucket, current + 1);
        return true;
      })
      .slice(0, Math.min(Math.max(userInterests.length * 2, 2), 8));
  })();
  const displayedForMeArticles = filteredArticles.slice(0, 5);

  return (
    <SteamiLayout>
      {/* Page Header */}
      <motion.div className="mb-8" variants={fadeInUp} initial="hidden" animate="visible">
        <h1 className="steami-heading text-3xl md:text-4xl mb-3">
          {user
            ? `Welcome, ${formatShortUserName(profile?.display_name ?? profile?.full_name ?? user.fullName)}`
            : 'Intelligence Dashboard'}
        </h1>
        <p className="text-[18px] font-medium text-muted-foreground max-w-xl leading-relaxed">
          Your personalized research hub. Notes, recommendations, and learning insights — all in one place.
        </p>
      </motion.div>

      {/* Profile Card — GET /api/auth/profile */}
      {profile && (
        <motion.div
          className="glass-card relative p-5 mb-6 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Avatar */}
            <div className="shrink-0 relative">
              <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-steami-cyan/30 ring-offset-2 ring-offset-background">
                {(profile.avatar_url || profile.google_picture) ? (
                  <img
                    src={profile.avatar_url ?? profile.google_picture}
                    alt={profile.display_name ?? profile.full_name ?? ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-steami-cyan/30 to-steami-magenta/30">
                    <span className="font-mono text-[13px] font-bold text-steami-cyan">
                      {getInitials(profile.display_name ?? profile.full_name ?? user?.fullName ?? 'U')}
                    </span>
                  </div>
                )}
              </div>
              {/* Online indicator */}
              <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-steami-green border-2 border-background" />
            </div>

            {/* Name + profession + bio */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-serif font-extrabold text-[16px] text-foreground">
                  {formatShortUserName(profile.display_name ?? profile.full_name ?? user?.fullName)}
                </p>
                {profile.role && profile.role !== 'user' && (
                  <span className="steami-badge steami-badge-gold text-[10px] uppercase">{profile.role}</span>
                )}
              </div>
              {profile.profession && (
                <p className="font-mono text-[12px] text-muted-foreground mt-0.5">{profile.profession}</p>
              )}
              {profile.bio && (
                <p className="text-[13px] text-muted-foreground mt-1 line-clamp-1">{sanitizeBio(profile.bio)}</p>
              )}
            </div>

            {/* Newsletter status */}
            <div className="shrink-0 flex flex-col items-stretch gap-1.5 sm:items-end">
              <button
                onClick={toggleNewsletter}
                disabled={newsletterLoading}
                className={`steami-btn text-[10px] px-3 py-2 ${profile.subscribed_newsletter ? 'steami-btn-gold' : ''}`}
                title={profile.subscribed_newsletter ? 'Unsubscribe from newsletter' : 'Subscribe to newsletter'}
              >
                {newsletterLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : profile.subscribed_newsletter ? (
                  <Bell className="w-3.5 h-3.5" />
                ) : (
                  <BellOff className="w-3.5 h-3.5" />
                )}
                Newsletter {profile.subscribed_newsletter ? 'Unsubscribe' : 'Subscribe'}
              </button>
              {newsletterMessage && (
                <span className="max-w-[180px] text-right font-mono text-[10px] text-muted-foreground">{newsletterMessage}</span>
              )}
            </div>

            {/* Interests count — from GET /api/auth/interests */}
            {userInterests.length > 0 && (
              <div className="shrink-0 text-right hidden sm:block">
                <p className="font-mono text-[20px] font-extrabold text-steami-cyan">{userInterests.length}</p>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Interests</p>
              </div>
            )}
          </div>

          {/* Interest tags row — GET /api/auth/interests */}
          {userInterests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-steami-cyan/10">
              {userInterests.map((topic) => (
                <span key={topic} className="steami-badge steami-badge-cyan text-[10px] flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {topic}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Interest prompt */}
      {userInterests.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card relative p-5 mb-6 overflow-hidden flex items-center gap-3"
        >
          <Sparkles className="w-5 h-5 text-steami-gold shrink-0" />
          <p className="text-[14px] text-muted-foreground font-medium">
            You haven't selected any interests yet.{' '}
            <Link to="/interests" className="text-steami-gold hover:underline">Update your interests</Link>{' '}
            to get personalized recommendations.
          </p>
        </motion.div>
      )}

      {/* Personalized topic cards (local explainers data) */}
      {personalizedExplainers.length > 0 && (
        <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="steami-section-label mb-3">✦ FOR YOU</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {personalizedExplainers.map((exp, idx) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.06 }}
                whileHover={cardHover}
              >
                <Link to={`/?open=${exp.id}`} className="glass-card relative p-5 overflow-hidden block h-full">
                  <span className={`steami-badge text-[16px] steami-badge-${exp.badgeColor} mb-2 inline-block`}>{exp.field}</span>
                  <h4 className="font-serif text-[18px] font-extrabold text-foreground leading-snug mb-1">{exp.title}</h4>
                  <p className="text-[14px] font-medium text-muted-foreground leading-relaxed line-clamp-2">{exp.subtitle}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: 'SAVED NOTES', value: totalNotes, icon: BookOpen, color: 'steami-gold' },
          { label: 'FIELDS EXPLORED', value: fields, icon: BarChart3, color: 'steami-cyan' },
          {
            label: 'NEWS READ',
            value: statsLoading ? '—' : (backendStats?.by_type?.research_article ?? '—'),
            icon: Activity,
            color: 'steami-green',
          },
          {
            label: 'POPUPS OPENED',
            value: statsLoading ? '—' : (backendStats?.total_events ?? '—'),
            icon: Zap,
            color: 'steami-violet',
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            custom={idx}
            variants={cardVariants}
            whileHover={cardHover}
            className="glass-card relative p-6 overflow-hidden text-center"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 + idx * 0.08, type: 'spring', stiffness: 300, damping: 18 }}>
              <stat.icon className={`w-5 h-5 mx-auto mb-2 text-${stat.color}`} />
            </motion.div>
            <motion.div className="font-mono text-2xl font-extrabold text-foreground mb-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + idx * 0.08 }}>
              {stat.value}
            </motion.div>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Activity Strip: 7-day heatmap + type breakdown */}
      {backendStats && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* 7-day activity bar */}
          <div className="glass-card relative p-5 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-steami-gold" />
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">7-Day Activity</span>
            </div>
            <div className="flex items-end gap-1.5 h-14">
              {last7Days.map(({ date, count }) => {
                const intensity = count / maxDayCount;
                const label = new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1" title={`${date}: ${count} events`}>
                    <div
                      className="w-full rounded-sm transition-all"
                      style={{
                        height: `${Math.max(4, intensity * 48)}px`,
                        background: count === 0
                          ? 'hsl(207 72% 65% / 0.08)'
                          : `hsl(207 72% 65% / ${0.2 + intensity * 0.75})`,
                      }}
                    />
                    <span className="font-mono text-[9px] text-muted-foreground">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By-type breakdown */}
          <div className="glass-card relative p-5 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-steami-cyan" />
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">By Content Type</span>
            </div>
            {typeBreakdown.length === 0 ? (
              <p className="font-mono text-[12px] text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {typeBreakdown.map(({ type, count }) => {
                  const pct = Math.round((count / (backendStats.total_events || 1)) * 100);
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className={`steami-badge text-[10px] shrink-0 ${TYPE_BADGE_CLASS[type] ?? 'steami-badge-cyan'}`}>
                        {TYPE_LABELS[type] ?? type}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-steami-cyan/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-steami-cyan/60"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Dual Radar Charts */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        <div>
          <div className="steami-section-label mb-3">✦ INTELLIGENCE PROFILE</div>
          <div className="glass-card relative p-6 overflow-hidden">
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                  { metric: 'Research Depth', value: Math.min(100, totalNotes * 15), fullMark: 100 },
                  { metric: 'Field Diversity', value: Math.min(100, fields * 20), fullMark: 100 },
                  { metric: 'Engagement',      value: Math.min(100, (backendStats?.total_events ?? 0) * 5), fullMark: 100 },
                  { metric: 'News',            value: Math.min(100, (backendStats?.by_type?.research_article ?? 0) * 25), fullMark: 100 },
                  { metric: 'Explainers',      value: Math.min(100, (backendStats?.by_type?.explainer ?? 0) * 15), fullMark: 100 },
                  { metric: 'Consistency',     value: Math.min(100, Object.keys(backendStats?.by_date ?? {}).length * 14), fullMark: 100 },
                ]}>
                  <PolarGrid stroke={isLight ? 'hsl(210 40% 75% / 0.4)' : 'hsl(207 72% 65% / 0.12)'} strokeWidth={0.5} />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: isLight ? 'hsl(210 30% 30%)' : 'hsl(210 25% 55%)', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Profile" dataKey="value" stroke="hsl(207 72% 65%)" strokeWidth={2} fill="hsl(207 72% 65%)" fillOpacity={isLight ? 0.1 : 0.15} dot={{ r: 3, fill: 'hsl(207 72% 65%)', stroke: 'hsl(207 72% 85%)', strokeWidth: 1 }} activeDot={{ r: 5, fill: 'hsl(42 75% 60%)', stroke: 'hsl(42 75% 70%)', strokeWidth: 2 }} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="glass-card relative px-3 py-2 overflow-hidden !border-steami-cyan/30">
                        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">{d.metric}</p>
                        <p className="font-mono text-sm font-extrabold text-foreground">{d.value}%</p>
                      </div>
                    );
                  }} />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>
            <div className="mt-2 pt-3 border-t border-steami-cyan/10">
              <motion.div className="flex items-center gap-2 text-steami-cyan font-mono text-[11px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                <TrendingUp className="w-3 h-3" />
                {(backendStats?.total_events ?? 0) > 0
                  ? 'Your research activity is growing. Keep exploring!'
                  : 'Start exploring to build your intelligence profile.'}
              </motion.div>
            </div>
          </div>
        </div>
        <SubjectRadarChart />
      </motion.div>

      {/* Most Opened + Recent Activity */}
      {backendStats && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div>
            <div className="steami-section-label mb-3">✦ MOST OPENED</div>
            <div className="glass-card relative p-5 overflow-hidden">
              {backendStats.most_opened.length === 0 ? (
                <p className="font-mono text-[12px] text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {backendStats.most_opened.slice(0, 6).map((item, idx) => (
                    <motion.div key={item.popup_id} className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * idx }}>
                      <span className="font-mono text-[11px] text-muted-foreground w-4 text-right shrink-0">{idx + 1}</span>
                      <span className={`steami-badge text-[10px] shrink-0 ${TYPE_BADGE_CLASS[item.popup_type] ?? 'steami-badge-cyan'}`}>
                        {TYPE_LABELS[item.popup_type] ?? item.popup_type}
                      </span>
                      <p className="font-medium text-[13px] text-foreground leading-snug flex-1 line-clamp-1">{item.popup_title}</p>
                      <span className="font-mono text-[11px] text-steami-gold shrink-0">×{item.count}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="steami-section-label mb-3">✦ RECENT ACTIVITY</div>
            <div className="glass-card relative p-5 overflow-hidden">
              {backendStats.recent.length === 0 ? (
                <p className="font-mono text-[12px] text-muted-foreground">No recent activity.</p>
              ) : (
                <div className="space-y-3">
                  {backendStats.recent.slice(0, 6).map((event, idx) => (
                    <motion.div key={event.id} className="flex items-start gap-3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * idx }}>
                      <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[13px] text-foreground leading-snug line-clamp-1">{event.popup_title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`steami-badge text-[10px] ${TYPE_BADGE_CLASS[event.popup_type] ?? 'steami-badge-cyan'}`}>
                            {TYPE_LABELS[event.popup_type] ?? event.popup_type}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">{formatRelativeTime(event.opened_at)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* AI Insights Section — GET /api/insights */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="steami-section-label mb-0">✦ AI INSIGHTS</div>
          <div className="flex items-center gap-3">
            {/* Insight progress from insight_stats in dashboard.me */}
            {insightStats && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {insightStats.articles_with_insight}/{insightStats.articles_total} news
                {insightStats.generating && (
                  <span className="ml-1 text-steami-cyan animate-pulse"> · generating…</span>
                )}
              </span>
            )}
            <Link
              to="/insights"
              className="steami-btn text-[11px] flex items-center gap-1"
            >
              VIEW ALL <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {insightsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : displayedInsights.length === 0 ? (
          <div className="glass-card relative p-8 text-center overflow-hidden">
            <Lightbulb className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-mono text-[12px] text-muted-foreground">No insights available yet.</p>
            <p className="text-[13px] text-muted-foreground mt-1">Insights are generated automatically after news is refreshed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedInsights.map((insight, idx) => (
              <motion.div
                key={insight.article_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * idx }}
                whileHover={cardHover}
                className="glass-card relative p-5 overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Lightbulb className="w-3.5 h-3.5 text-steami-gold shrink-0" />
                  {insight.topic && (
                    <span className="steami-badge steami-badge-gold text-[10px]">{insight.topic}</span>
                  )}
                  {insight.ai_insight?.domain && (
                    <span className="steami-badge steami-badge-violet text-[10px]">{insight.ai_insight.domain}</span>
                  )}
                </div>

                <h4 className="font-serif text-[14px] font-extrabold text-foreground leading-snug mb-2 line-clamp-2">
                  {insight.title}
                </h4>

                {insight.ai_insight?.summary && (
                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3 mb-2">
                    {insight.ai_insight.summary}
                  </p>
                )}

                {insight.ai_insight?.key_points && insight.ai_insight.key_points.length > 0 && (
                  <ul className="space-y-0.5 mb-2">
                    {insight.ai_insight.key_points.slice(0, 2).map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <span className="text-steami-cyan mt-0.5 shrink-0">›</span>
                        <span className="line-clamp-1">{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-steami-cyan/10">
                  {insight.source && (
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">{insight.source}</span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <PopupLinkPill
                      type="insight"
                      id={insight.article_id}
                      title={insight.title}
                      className="py-1 px-2"
                    />
                    {insight.article_url && (
                      <a
                        href={insight.article_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-steami-cyan hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Source
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Research Diary + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Research Diary — local store, unchanged */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="steami-section-label mb-0">✦ RESEARCH DIARY</div>
            {diary.length > 0 && (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={clearDiary} className="steami-btn text-[11px] py-1 px-2.5" style={{ borderColor: 'rgba(252, 92, 101, 0.3)', color: 'hsl(var(--steami-red))' }}>
                CLEAR ALL
              </motion.button>
            )}
          </div>

          {diary.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="glass-card relative p-10 text-center overflow-hidden">
              <motion.div className="text-4xl mb-4" animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>📓</motion.div>
              <p className="font-mono text-sm text-muted-foreground mb-2">No notes saved yet</p>
              <p className="text-[14px] font-medium text-muted-foreground mb-5">Select text in any Explainer or Research News item to save it here.</p>
              <div className="flex gap-2 justify-center">
                <Link to="/" className="steami-btn text-[11px]"><BookOpen className="w-3 h-3" /> EXPLAINERS</Link>
                <Link to="/research" className="steami-btn steami-btn-gold text-[11px]"><ExternalLink className="w-3 h-3" /> RESEARCH</Link>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {diary.map((entry, idx) => (
                  <motion.div key={entry.id} initial={{ opacity: 0, x: -20, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }} transition={{ delay: idx * 0.04 }} layout className="glass-card relative p-5 overflow-hidden group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`steami-badge text-[16px] ${entry.sourceType === 'article' ? 'steami-badge-cyan' : 'steami-badge-violet'}`}>{entry.sourceType}</span>
                          {entry.field && <span className="steami-badge steami-badge-gold text-[10px]">{entry.field}</span>}
                        </div>
                        <p className="text-[15px] font-medium text-foreground/80 leading-relaxed mb-1">"{entry.text}"</p>
                        <p className="font-mono text-[11px] text-muted-foreground">from: {entry.source}</p>
                      </div>
                      <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }} onClick={() => removeDiaryEntry(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-steami-red">
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Feed — GET /api/articles/for-me + GET /api/articles/refresh/check */}
        <motion.div className="lg:sticky lg:top-24 lg:self-start" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.45 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="steami-section-label mb-0">✦ FOR ME</div>
            {/* New articles badge — from GET /api/articles/refresh/check */}
            {(refreshCheck?.new_articles ?? 0) > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5">
                <Newspaper className="w-3 h-3 text-steami-green" />
                <span className="font-mono text-[10px] text-steami-green uppercase tracking-wider">
                  {refreshCheck!.new_articles} new
                </span>
              </motion.div>
            )}
          </div>

          <div className="flex gap-1 mb-3 flex-wrap">
            {(['all', 'article', 'news', 'explainer'] as const).map((f) => (
              <motion.button
                key={f}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setFeedFilter(f)}
                className={`font-mono text-[11px] tracking-wider uppercase px-3 py-1.5 rounded-md transition-all ${feedFilter === f ? 'text-steami-gold bg-steami-gold/10' : 'text-muted-foreground hover:text-foreground bg-transparent'}`}
                style={{ border: `1px solid ${feedFilter === f ? 'rgba(232, 184, 75, 0.3)' : 'rgba(99, 179, 237, 0.1)'}` }}
              >
                {f}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {articlesLoading ? (
                <div className="glass-card relative p-8 overflow-hidden text-center">
                  <p className="font-mono text-[12px] text-muted-foreground animate-pulse">Loading news…</p>
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="glass-card relative p-8 overflow-hidden text-center">
                  <p className="font-mono text-[12px] text-muted-foreground">No news found.</p>
                </div>
              ) : (
                displayedForMeArticles.map((article, idx) => {
                  const domains = article.matched_domains ?? [];
                  const articleUrl = article.article_url ?? article.url;
                  return (
                    <motion.div
                      key={article.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.04 }}
                      whileHover={cardHover}
                      className="glass-card relative p-5 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {domains.slice(0, 2).map((d) => (
                          <span key={d} className="steami-badge steami-badge-cyan text-[10px]">{d}</span>
                        ))}
                        {article.source && (
                          <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px]">{article.source}</span>
                        )}
                        {article.has_insight && (
                          <span className="steami-badge steami-badge-gold text-[10px] flex items-center gap-1">
                            <Lightbulb className="w-2.5 h-2.5" /> insight
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif text-[15px] font-extrabold text-foreground leading-snug mb-1 line-clamp-2">
                        {article.title}
                      </h4>
                      {article.short_summary && (
                        <p className="text-[12px] font-medium text-muted-foreground leading-relaxed line-clamp-2">
                          {article.short_summary}
                        </p>
                      )}
                      {articleUrl && (
                        <a
                          href={articleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-steami-cyan mt-2 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Read more
                        </a>
                      )}
                    </motion.div>
                  );
                })
              )}
              {!articlesLoading && filteredArticles.length > displayedForMeArticles.length && (
                <Link
                  to="/research"
                  className="steami-btn text-[11px] w-full flex items-center justify-center gap-1 mt-3"
                >
                  VIEW MORE <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </AnimatePresence>
        </motion.div>
      </div>
    </SteamiLayout>
  );
}