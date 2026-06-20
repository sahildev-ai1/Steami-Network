/**
 * RelatedContentPanel  — inline sidebar version
 * Used inside ExplainerPage and ResearchPage popup right panels,
 * and in BlogArticlePage sidebar.
 *
 * Place at: src/components/RelatedContentPanel.tsx
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Lightbulb, FlaskConical, BookOpen, Layers, Loader2 } from 'lucide-react';

// ─── types ────────────────────────────────────────────────────────────────────

type Tab = 'explainers' | 'research' | 'intelligence';

interface RawExplainer {
  id: string; title: string; field?: string; readTime?: string;
  keyInsights?: string[]; relatedTopics?: string[];
}
interface RawResearch {
  id: string; title: string; field?: string; readTime?: string;
  abstract?: string; keyFindings?: string[]; relatedTopics?: string[];
}
interface RawBlog {
  id: string; title: string; field?: string;
  readingTime?: string; readTime?: string;
  tags?: string[]; keyInsights?: string[];
}

interface RelatedItem {
  id: string; title: string; field?: string; readTime?: string;
  keywords: string[]; // extracted for relevance scoring
}

export interface RelatedContentPanelProps {
  field?: string;
  currentId?: string;
  currentTitle?: string;
  /** keywords from keyInsights / relatedTopics / tags of the current item */
  currentKeywords?: string[];
  isLight: boolean;
  onOpenExplainer?: (id: string) => void;
  onOpenResearch?:  (id: string) => void;
}

// ─── fetch ────────────────────────────────────────────────────────────────────

const API_BASE = (
  (import.meta as any).env?.VITE_API_BASE_URL ?? ''
).replace(/\/$/, '');

async function apiFetch(path: string): Promise<any> {
  const token = localStorage.getItem('steami_token') ?? localStorage.getItem('token') ?? '';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── relevance ───────────────────────────────────────────────────────────────
/**
 * Score an item vs current content.
 * — Same field:         +20  (strongest signal)
 * — Matching keyword:  +5 each  (keyInsights / relatedTopics / tags overlap)
 * — Title word match:  +2 each  (words > 4 chars)
 */
function scoreItem(
  item: RelatedItem,
  field?: string,
  keywords?: string[],
  title?: string,
): number {
  let s = 0;
  if (field && item.field && item.field.toLowerCase() === field.toLowerCase()) s += 20;

  const itemKw = item.keywords.map(k => k.toLowerCase());
  if (keywords?.length) {
    keywords.forEach(kw => {
      if (itemKw.some(k => k.includes(kw.toLowerCase()) || kw.toLowerCase().includes(k))) s += 5;
    });
  }
  if (title) {
    title.toLowerCase().split(/\s+/).filter(w => w.length > 4).forEach(w => {
      if (item.title.toLowerCase().includes(w)) s += 2;
    });
  }
  return s;
}

function rankItems(
  items: RelatedItem[],
  field?: string,
  keywords?: string[],
  title?: string,
  excludeId?: string,
): RelatedItem[] {
  return items
    .filter(i => i.id !== excludeId)
    .map(i => ({ item: i, score: scoreItem(i, field, keywords, title) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.item)
    .slice(0, 5);
}

// ─── normalise raw API responses ──────────────────────────────────────────────

function normExplainers(raw: any): RelatedItem[] {
  const items: RawExplainer[] = Array.isArray(raw) ? raw : raw?.explainers ?? raw?.items ?? [];
  return items.map(e => ({
    id: e.id, title: e.title ?? 'Untitled',
    field: e.field ?? '', readTime: e.readTime ?? '',
    keywords: [...(e.keyInsights ?? []), ...(e.relatedTopics ?? [])],
  }));
}

function normResearch(raw: any): RelatedItem[] {
  const items: RawResearch[] = Array.isArray(raw) ? raw : raw?.articles ?? raw?.items ?? [];
  return items.map(a => ({
    id: a.id, title: a.title ?? 'Untitled',
    field: a.field ?? '', readTime: a.readTime ?? '',
    keywords: [...(a.keyFindings ?? []), ...(a.relatedTopics ?? [])],
  }));
}

function normBlog(raw: any): RelatedItem[] {
  const items: RawBlog[] = Array.isArray(raw) ? raw : raw?.posts ?? raw?.items ?? [];
  return items.map(p => ({
    id: p.id, title: p.title ?? 'Untitled',
    field: p.field ?? '', readTime: p.readingTime ?? p.readTime ?? '',
    keywords: [...(p.tags ?? []), ...(p.keyInsights ?? [])],
  }));
}

// ─── tab config ───────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; Icon: React.ElementType }[] = [
  { key: 'explainers',   label: 'Explainers',   Icon: Lightbulb },
  { key: 'research',     label: 'Research',     Icon: FlaskConical },
  { key: 'intelligence', label: 'Intelligence', Icon: BookOpen },
];

// ─── component ────────────────────────────────────────────────────────────────

export function RelatedContentPanel({
  field, currentId, currentTitle, currentKeywords,
  isLight, onOpenExplainer, onOpenResearch,
}: RelatedContentPanelProps) {
  const [tab, setTab]               = useState<Tab>('explainers');
  const [explainers, setExplainers] = useState<RelatedItem[]>([]);
  const [research, setResearch]     = useState<RelatedItem[]>([]);
  const [blog, setBlog]             = useState<RelatedItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    setLoading(true);
    setFetchError('');
    Promise.allSettled([
      apiFetch('/api/explainers'),
      apiFetch('/api/research/articles'),  // ← correct endpoint
      apiFetch('/api/blog'),
    ]).then(([eR, rR, bR]) => {
      let anyOk = false;
      if (eR.status === 'fulfilled') { anyOk = true; setExplainers(normExplainers(eR.value)); }
      if (rR.status === 'fulfilled') { anyOk = true; setResearch(normResearch(rR.value)); }
      if (bR.status === 'fulfilled') { anyOk = true; setBlog(normBlog(bR.value)); }
      if (!anyOk) setFetchError('Could not load related content.');
    }).finally(() => setLoading(false));
  }, []);

  const kw = currentKeywords ?? [];
  const lists: Record<Tab, RelatedItem[]> = {
    explainers:   rankItems(explainers, field, kw, currentTitle, currentId),
    research:     rankItems(research,   field, kw, currentTitle, currentId),
    intelligence: rankItems(blog,       field, kw, currentTitle, currentId),
  };

  // theme
  const bg          = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(5,14,32,0.95)';
  const border      = isLight ? '1px solid rgba(99,179,237,0.3)' : '1px solid rgba(99,179,237,0.2)';
  const cyan        = 'hsl(187 72% 55%)';
  const muted       = isLight ? '#64748b' : '#94a3b8';
  const activeTabBg = isLight ? 'rgba(6,182,212,0.12)' : 'rgba(99,179,237,0.15)';
  const activeBdr   = isLight ? 'rgba(99,179,237,0.45)' : 'rgba(99,179,237,0.32)';
  const hoverBg     = isLight ? 'rgba(99,179,237,0.07)' : 'rgba(99,179,237,0.09)';
  const fieldClr    = isLight ? '#0369a1' : '#7dd3fc';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl overflow-hidden w-full mt-1 flex-shrink-0"
      style={{ background: bg, border }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5 mb-3">
          <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: cyan }} />
          <span className="font-mono text-[11px] tracking-widest uppercase font-semibold" style={{ color: cyan }}>
            Related Content
          </span>
        </div>
        {/* 3 equal tabs — grid so they never overlap */}
        <div className="grid grid-cols-3 gap-1">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-lg transition-all duration-200"
                style={{
                  background: active ? activeTabBg : 'transparent',
                  color:      active ? cyan : muted,
                  border:     `1px solid ${active ? activeBdr : 'transparent'}`,
                }}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="font-mono text-[9px] sm:text-[10px] tracking-wide uppercase leading-tight">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mx-3" style={{
        background: isLight
          ? 'linear-gradient(90deg,transparent,rgba(147,197,253,0.4),transparent)'
          : 'linear-gradient(90deg,transparent,rgba(99,179,237,0.15),transparent)',
      }} />

      {/* Content */}
      <div className="px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-7">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: cyan }} />
          </div>
        ) : fetchError ? (
          <p className="font-mono text-[10px] text-center py-5" style={{ color: muted }}>{fetchError}</p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
            >
              {lists[tab].length === 0 ? (
                <p className="font-mono text-[10px] text-center py-5" style={{ color: muted }}>
                  No related {tab} found.
                </p>
              ) : lists[tab].map(item => (
                <ItemRow key={item.id} item={item} tab={tab}
                  hoverBg={hoverBg} fieldClr={fieldClr}
                  onOpenExplainer={onOpenExplainer}
                  onOpenResearch={onOpenResearch}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ─── item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, tab, hoverBg, fieldClr, onOpenExplainer, onOpenResearch }: {
  item: RelatedItem; tab: Tab;
  hoverBg: string; fieldClr: string;
  onOpenExplainer?: (id: string) => void;
  onOpenResearch?:  (id: string) => void;
}) {
  const inner = (
    <>
      <div className="font-serif text-[13px] font-bold text-foreground leading-snug line-clamp-2">
        {item.title}
      </div>
      {(item.field || item.readTime) && (
        <div className="font-mono text-[10px] mt-0.5 leading-none" style={{ color: fieldClr }}>
          {[item.field, item.readTime].filter(Boolean).join(' · ')}
        </div>
      )}
    </>
  );

  const cls = 'block w-full text-left px-2 py-2 rounded-lg mb-0.5 cursor-pointer';
  const on  = (e: React.MouseEvent<HTMLElement>, in_: boolean) =>
    (e.currentTarget.style.background = in_ ? hoverBg : 'transparent');

  if (tab === 'intelligence') {
    return (
      <Link to={`/blog/${item.id}`} className={cls}
        style={{ background: 'transparent' }}
        onMouseEnter={e => on(e, true)} onMouseLeave={e => on(e, false)}>
        {inner}
      </Link>
    );
  }
  if (tab === 'explainers') {
    return onOpenExplainer
      ? <button className={cls} style={{ background: 'transparent' }}
          onClick={() => onOpenExplainer(item.id)}
          onMouseEnter={e => on(e, true)} onMouseLeave={e => on(e, false)}>{inner}</button>
      : <Link to={`/explainers?explainer=${encodeURIComponent(item.id)}`} className={cls}
          style={{ background: 'transparent' }}
          onMouseEnter={e => on(e, true)} onMouseLeave={e => on(e, false)}>{inner}</Link>;
  }
  // research
  return onOpenResearch
    ? <button className={cls} style={{ background: 'transparent' }}
        onClick={() => onOpenResearch(item.id)}
        onMouseEnter={e => on(e, true)} onMouseLeave={e => on(e, false)}>{inner}</button>
    : <Link to={`/research?research=${encodeURIComponent(item.id)}`} className={cls}
        style={{ background: 'transparent' }}
        onMouseEnter={e => on(e, true)} onMouseLeave={e => on(e, false)}>{inner}</Link>;
}