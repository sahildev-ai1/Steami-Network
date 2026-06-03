import { motion } from 'framer-motion';
import { useThemeStore } from '@/stores/theme-store';

interface Citation {
  id?: string | number;
  text?: string;
  source_title?: string;
  source_url?: string;
  accessed_date?: string;
}

interface BlogContentProps {
  content: string;
  citations?: Citation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Slugify — matches the logic in TableOfContents so IDs line up
// ─────────────────────────────────────────────────────────────────────────────
function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline markdown → HTML  (bold, italic, underline, code, links, images)
// Must match the editor's inlineMarkdownToHtml exactly.
// ─────────────────────────────────────────────────────────────────────────────
function inlineMarkdownToHtml(text: string): string {
  let html = text;

  // Standalone citation markers like [1] [2] — wrap in anchor so user can click to jump
  html = html.replace(
    /\[(\d+)\]/g,
    '<a href="#citation-$1" style="color:#63b3ed;font-weight:700;font-size:0.78em;vertical-align:super;text-decoration:none;" title="Citation $1">[$1]</a>'
  );

  // Images: ![alt](url)
  html = html.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:16px 0;display:block;border:1px solid rgba(255,255,255,0.08);" />'
  );

  // Links: [text](url)  — must come after images
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" style="color:#00d9ff;text-decoration:underline;font-weight:500;" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic (after bold so **x** doesn't match *)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Underline passthrough
  html = html.replace(/<u>(.*?)<\/u>/g, '<u>$1</u>');

  // Inline code
  html = html.replace(
    /`(.*?)`/g,
    '<code style="color:#00d9ff;background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.15);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.88em;">$1</code>'
  );

  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// markdownToHtml — converts the editor's saved markdown string to display HTML.
// Mirrors the editor's markdownToHtml but uses inline styles (no Tailwind
// classes) so it works identically in both light and dark themes without
// relying on prose utilities.
// ─────────────────────────────────────────────────────────────────────────────
function markdownToHtml(markdown: string, isLight: boolean): string {
  if (!markdown) return '';

  const TEXT_COLOR   = isLight ? 'rgba(30,41,59,0.85)'  : 'rgba(255,255,255,0.72)';
  const HEAD_COLOR   = isLight ? '#0f172a'               : '#ffffff';
  const QUOTE_BG     = isLight ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)';
  const HR_COLOR     = isLight ? 'rgba(0,0,0,0.1)'       : 'rgba(255,255,255,0.1)';

  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const tag   = listType;
    const style = tag === 'ul'
      ? `padding-left:1.5rem;margin:14px 0;list-style:disc outside;`
      : `padding-left:1.5rem;margin:14px 0;list-style:decimal outside;`;
    const items = listItems
      .map(li => `<li style="margin-bottom:6px;line-height:1.75;color:${TEXT_COLOR};">${inlineMarkdownToHtml(li)}</li>`)
      .join('');
    blocks.push(`<${tag} style="${style}">${items}</${tag}>`);
    listItems = [];
    listType  = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { flushList(); continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      blocks.push(`<hr style="border:none;border-top:1px solid ${HR_COLOR};margin:28px 0;" />`);
      continue;
    }

    // Direct HTML passthrough — iframes, video, raw img tags from editor
    if (
      trimmed.startsWith('<iframe')  || trimmed.startsWith('<video') ||
      trimmed.startsWith('<img ')    || trimmed.startsWith('<div align') ||
      trimmed.startsWith('<div style="text-align')
    ) {
      flushList();
      // Wrap iframes in responsive container
      if (trimmed.startsWith('<iframe')) {
        blocks.push(
          `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:8px;margin:18px 0;border:1px solid rgba(255,255,255,0.08);">` +
          line +
          `</div>`
        );
      } else {
        blocks.push(line);
      }
      continue;
    }

    // Headings — add id for TableOfContents
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      flushList();
      const level   = hMatch[1].length;
      const text    = hMatch[2];
      const id      = slugify(text);
      const content = inlineMarkdownToHtml(text);
      const sizes: Record<number, string> = {
        1: `font-size:26px;font-weight:800;margin:28px 0 14px;`,
        2: `font-size:22px;font-weight:700;margin:24px 0 12px;`,
        3: `font-size:19px;font-weight:700;margin:20px 0 10px;`,
        4: `font-size:17px;font-weight:600;margin:16px 0 8px;`,
      };
      const s = sizes[level] ?? `font-size:16px;font-weight:600;margin:14px 0 6px;`;
      blocks.push(
        `<h${level} id="${id}" style="color:${HEAD_COLOR};line-height:1.3;font-family:serif;${s}">${content}</h${level}>`
      );
      continue;
    }

    // Blockquote
    const qMatch = line.match(/^>\s?(.*)$/);
    if (qMatch) {
      flushList();
      blocks.push(
        `<blockquote style="border-left:2px solid rgba(251,191,36,0.7);background:${QUOTE_BG};padding:10px 18px;margin:18px 0;border-radius:0 6px 6px 0;font-style:italic;color:${TEXT_COLOR};">${inlineMarkdownToHtml(qMatch[1])}</blockquote>`
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    // Default paragraph
    flushList();
    blocks.push(
      `<p style="margin:14px 0;line-height:1.8;font-size:16px;font-weight:500;color:${TEXT_COLOR};">${inlineMarkdownToHtml(line)}</p>`
    );
  }

  flushList();
  return blocks.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitizer — allows style attributes, blocks event handlers & bad protocols.
// Identical allow-list to the editor so the round-trip is lossless.
// ─────────────────────────────────────────────────────────────────────────────
function sanitize(html: string): string {
  const ALLOWED = new Set([
    'p','strong','b','em','i','u','del','s','strike','code',
    'h1','h2','h3','h4','h5','h6',
    'ul','ol','li','blockquote','hr','br','a','img',
    'iframe','video','source','div','span',
  ]);

  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el  = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED.has(tag)) return null;

    if (tag === 'iframe') {
      const src = el.getAttribute('src') || '';
      if (!src.startsWith('https://www.youtube.com/') && !src.startsWith('https://youtube.com/')) return null;
    }

    const out = document.createElement(tag);
    for (let i = 0; i < el.attributes.length; i++) {
      const { name, value } = el.attributes[i];
      if (name.startsWith('on')) continue;
      if ((name === 'href' || name === 'src') &&
          (value.trim().toLowerCase().startsWith('javascript:') ||
           value.trim().toLowerCase().startsWith('data:'))) continue;
      out.setAttribute(name, value);
    }
    el.childNodes.forEach(c => { const r = clean(c); if (r) out.appendChild(r); });
    return out;
  };

  const tmp = document.createElement('div');
  doc.body.childNodes.forEach(c => { const r = clean(c); if (r) tmp.appendChild(r); });
  return tmp.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function BlogContent({ content, citations }: BlogContentProps) {
  const isLight = useThemeStore(s => s.theme === 'light');

  const html = sanitize(markdownToHtml(content, isLight));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      {/* Article body */}
      <div
        className="blog-content"
        style={{ fontSize: '16px', lineHeight: 1.8 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Global image styles injected once */}
      <style>{`
        .blog-content img {
          max-width: 100%;
          border-radius: 8px;
          margin: 16px 0;
          display: block;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .blog-content iframe {
          width: 100%;
          border-radius: 8px;
        }
        .blog-content ul { list-style: disc outside; padding-left: 1.5rem; margin: 14px 0; }
        .blog-content ol { list-style: decimal outside; padding-left: 1.5rem; margin: 14px 0; }
        .blog-content li { margin-bottom: 6px; line-height: 1.75; }
        .blog-content a  { color: #00d9ff; text-decoration: underline; }
        .blog-content a:hover { color: #fbbf24; }
        .blog-content strong { font-weight: 700; }
        .blog-content em { font-style: italic; }
      `}</style>
    </motion.div>
  );
}
