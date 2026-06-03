import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme-store';

interface TableOfContentsProps {
  content: string;
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const isLight    = useThemeStore(s => s.theme === 'light');
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    // Extract headings from markdown source (## / ###)
    const extracted: Heading[] = [];
    content.split('\n').forEach(line => {
      const m = line.match(/^(#{2,4})\s+(.+)$/);
      if (m) extracted.push({ level: m[1].length, text: m[2], id: slugify(m[2]) });
    });
    setHeadings(extracted);

    // Wait for BlogContent to paint, then observe the real DOM headings
    let observer: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      observer = new IntersectionObserver(
        entries => entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id); }),
        { rootMargin: '-20% 0% -75% 0%' }
      );
      extracted.forEach(h => {
        const el = document.getElementById(h.id);
        if (el) observer!.observe(el);
      });
    }, 600);

    return () => { clearTimeout(timer); observer?.disconnect(); };
  }, [content]);

  if (headings.length === 0) return null;

  return (
    <div
      className="p-5 rounded-xl mb-6"
      style={{
        background:     isLight ? 'rgba(255,255,255,0.7)' : 'rgba(5,14,32,0.6)',
        backdropFilter: 'blur(12px)',
        border:         isLight ? '1px solid rgba(147,197,253,0.3)' : '1px solid rgba(99,179,237,0.1)',
      }}
    >
      <h4 className="font-mono text-[11px] tracking-wider uppercase text-steami-cyan mb-4">On This Page</h4>
      <ul className="space-y-2.5">
        {headings.map(h => (
          <li key={h.id} style={{ paddingLeft: `${(h.level - 2) * 12}px` }}>
            <a
              href={`#${h.id}`}
              className={`text-[13px] transition-colors duration-200 block truncate ${
                activeId === h.id
                  ? 'text-steami-gold font-semibold'
                  : 'text-muted-foreground hover:text-steami-cyan'
              }`}
              onClick={e => {
                e.preventDefault();
                const el = document.getElementById(h.id);
                if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
