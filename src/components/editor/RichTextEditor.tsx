import * as React from "react";
import { RichTextToolbar } from "./RichTextToolbar";
import { EmbedModal } from "./EmbedModal";
import { MediaUploader } from "./MediaUploader";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Maximize2, Minimize2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline image upload helper — calls POST /api/blog/content-image
// Returns the Cloudinary CDN URL. Throws on failure.
// ─────────────────────────────────────────────────────────────────────────────

async function uploadContentImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const result = await api.content.uploadBlogContentImage(form);
  if (!result?.url) throw new Error("No URL returned from image upload");
  return result.url;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML <-> Markdown Utilities
// ─────────────────────────────────────────────────────────────────────────────

const IMG_STYLE =
  'max-width:100%;border-radius:8px;margin:12px 0;display:block;border:1px solid rgba(255,255,255,0.08);';

function inlineMarkdownToHtml(text: string): string {
  let html = text;

  // Images: ![alt](url)  — keep as real <img> so the browser can show them
  html = html.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    `<img src="$2" alt="$1" style="${IMG_STYLE}" />`
  );

  // Links: [text](url)
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" style="color:#00d9ff;text-decoration:underline;font-weight:500;" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic: *text*  (only after bold so **x** doesn't match *)
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // Underline — pass-through <u> tags
  html = html.replace(/<u>(.*?)<\/u>/g, "<u>$1</u>");

  // Inline Code
  html = html.replace(
    /`(.*?)`/g,
    '<code style="color:#00d9ff;background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.15);padding:2px 5px;border-radius:4px;font-family:monospace;font-size:0.9em;">$1</code>'
  );

  return html;
}

function markdownToHtml(markdown: string): string {
  if (!markdown) return "<p><br></p>";

  const lines = markdown.split(/\r?\n/);
  const htmlBlocks: string[] = [];
  let currentList: string[] = [];
  let currentListType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (!currentListType || currentList.length === 0) return;
    const tag = currentListType;
    // ul → list-disc, ol → list-decimal (was "list-decimal" for BOTH — bug fixed)
    const cls =
      tag === "ul"
        ? "list-disc pl-6 my-3 space-y-1 text-muted-foreground"
        : "list-decimal pl-6 my-3 space-y-1 text-muted-foreground";
    const items = currentList
      .map((li) => `<li style="margin-bottom:4px;">${inlineMarkdownToHtml(li)}</li>`)
      .join("");
    htmlBlocks.push(`<${tag} style="padding-left:1.5rem;margin:12px 0;list-style:${tag === "ul" ? "disc" : "decimal"} inside;">${items}</${tag}>`);
    currentList = [];
    currentListType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { closeList(); continue; }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      closeList();
      htmlBlocks.push('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;" />');
      continue;
    }

    // Direct HTML passthrough (iframes, video tags)
    if (trimmed.startsWith("<iframe") || trimmed.startsWith("<video")) {
      closeList();
      htmlBlocks.push(line);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const content = inlineMarkdownToHtml(headingMatch[2]);
      const sizes: Record<number, string> = {
        1: "font-size:24px;font-weight:700;margin:24px 0 12px;",
        2: "font-size:20px;font-weight:700;margin:20px 0 10px;",
        3: "font-size:18px;font-weight:600;margin:16px 0 8px;",
      };
      const s = sizes[level] || "font-size:16px;font-weight:600;margin:14px 0 6px;";
      htmlBlocks.push(`<h${level} style="color:#fff;line-height:1.3;${s}">${content}</h${level}>`);
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeList();
      const content = inlineMarkdownToHtml(quoteMatch[1]);
      htmlBlocks.push(
        `<blockquote style="border-left:2px solid rgba(251,191,36,0.7);background:rgba(251,191,36,0.05);padding:10px 16px;margin:16px 0;border-radius:0 6px 6px 0;font-style:italic;">${content}</blockquote>`
      );
      continue;
    }

    // Unordered List (- or *)
    const ulMatch = line.match(/^[\s]*[-*]\s+(.*)$/);
    if (ulMatch) {
      if (currentListType === "ol") closeList();
      currentListType = "ul";
      currentList.push(ulMatch[1]);
      continue;
    }

    // Ordered List (1. 2. etc.)
    const olMatch = line.match(/^[\s]*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (currentListType === "ul") closeList();
      currentListType = "ol";
      currentList.push(olMatch[1]);
      continue;
    }

    // Center alignment wrapper
    if (trimmed.startsWith('<div align="center">') || trimmed.startsWith('<div style="text-align: center;">')) {
      closeList();
      let inner = "";
      if (trimmed.endsWith("</div>")) {
        inner = trimmed.substring(trimmed.indexOf(">") + 1, trimmed.lastIndexOf("</div"));
        htmlBlocks.push(`<div style="text-align:center;margin:8px 0;">${inlineMarkdownToHtml(inner)}</div>`);
      } else {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().endsWith("</div>")) {
          inner += lines[j] + "\n"; j++;
        }
        i = j;
        htmlBlocks.push(`<div style="text-align:center;margin:8px 0;">${inlineMarkdownToHtml(inner.trim())}</div>`);
      }
      continue;
    }

    // Right alignment wrapper
    if (trimmed.startsWith('<div align="right">') || trimmed.startsWith('<div style="text-align: right;">')) {
      closeList();
      let inner = "";
      if (trimmed.endsWith("</div>")) {
        inner = trimmed.substring(trimmed.indexOf(">") + 1, trimmed.lastIndexOf("</div"));
        htmlBlocks.push(`<div style="text-align:right;margin:8px 0;">${inlineMarkdownToHtml(inner)}</div>`);
      } else {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().endsWith("</div>")) {
          inner += lines[j] + "\n"; j++;
        }
        i = j;
        htmlBlocks.push(`<div style="text-align:right;margin:8px 0;">${inlineMarkdownToHtml(inner.trim())}</div>`);
      }
      continue;
    }

    // Default paragraph
    closeList();
    htmlBlocks.push(
      `<p style="margin:12px 0;line-height:1.75;font-size:14px;color:rgba(255,255,255,0.7);">${inlineMarkdownToHtml(line)}</p>`
    );
  }

  closeList();
  return htmlBlocks.join("\n");
}

function htmlToMarkdown(html: string): string {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  const convertNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    let children = "";
    el.childNodes.forEach((c) => { children += convertNode(c); });

    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "strong": case "b":
        return children.trim() ? `**${children.trim()}**` : "";
      case "em": case "i":
        return children.trim() ? `*${children.trim()}*` : "";
      case "u":
        return children.trim() ? `<u>${children.trim()}</u>` : "";
      case "strike": case "s": case "del":
        return children.trim() ? `~~${children.trim()}~~` : "";
      case "code":
        return children.trim() ? `\`${children.trim()}\`` : "";
      case "h1": return `\n# ${children.trim()}\n\n`;
      case "h2": return `\n## ${children.trim()}\n\n`;
      case "h3": return `\n### ${children.trim()}\n\n`;
      case "blockquote":
        return `\n> ${children.trim().replace(/\n/g, "\n> ")}\n\n`;
      case "ul": case "ol":
        return `\n${children}\n`;
      case "li": {
        const parentTag = el.parentElement?.tagName.toLowerCase();
        if (parentTag === "ol") {
          const idx = Array.from(el.parentElement!.children).indexOf(el) + 1;
          return `${idx}. ${children.trim()}\n`;
        }
        return `- ${children.trim()}\n`;
      }
      case "p":
        return children.trim() ? `${children.trim()}\n\n` : "";
      case "a":
        return `[${children.trim() || el.getAttribute("href")}](${el.getAttribute("href") || ""})`;
      case "img":
        // Preserve the src exactly — it's already a Cloudinary URL at this point
        return `![${el.getAttribute("alt") || "image"}](${el.getAttribute("src") || ""})`;
      case "iframe": case "video":
        return `\n${el.outerHTML}\n\n`;
      case "hr":
        return `\n---\n\n`;
      case "br":
        return "\n";
      case "div": {
        const align = el.style.textAlign || el.getAttribute("align");
        if (align === "center") return `\n<div align="center">\n\n${children.trim()}\n\n</div>\n\n`;
        if (align === "right")  return `\n<div align="right">\n\n${children.trim()}\n\n</div>\n\n`;
        return children.trim() ? `${children.trim()}\n\n` : "";
      }
      default:
        return children;
    }
  };

  let md = "";
  tempDiv.childNodes.forEach((n) => { md += convertNode(n); });

  return md.replace(/\n{3,}/g, "\n\n").replace(/&nbsp;/g, " ").trim();
}

function getYouTubeEmbedUrl(url: string): string | null {
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? `https://www.youtube.com/embed/${m[2]}` : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitizer — allows class AND style attributes so Tailwind and inline styles
// survive the round-trip inside the editor. Only blocks event handlers and
// dangerous protocols.
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const ALLOWED_TAGS = new Set([
    "p","strong","b","em","i","h1","h2","h3","ul","ol","li",
    "blockquote","code","a","img","iframe","span","div","hr","br","del","u","s","strike",
  ]);

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) return null;

    // Only allow YouTube iframes
    if (tagName === "iframe") {
      const src = el.getAttribute("src") || "";
      if (!src.startsWith("https://www.youtube.com/") && !src.startsWith("https://youtube.com/")) return null;
    }

    const clean = document.createElement(tagName);

    for (let i = 0; i < el.attributes.length; i++) {
      const { name, value } = el.attributes[i];
      // Block event handlers
      if (name.startsWith("on")) continue;
      // Block javascript: and data: on href/src (data: image URIs not needed since we upload to Cloudinary)
      if ((name === "href" || name === "src") &&
          (value.trim().toLowerCase().startsWith("javascript:") ||
           value.trim().toLowerCase().startsWith("data:"))) continue;
      // Allow style — it's how we ship list/heading/blockquote styling
      clean.setAttribute(name, value);
    }

    el.childNodes.forEach((child) => {
      const c = cleanNode(child);
      if (c) clean.appendChild(c);
    });

    return clean;
  };

  const tmp = document.createElement("div");
  doc.body.childNodes.forEach((child) => {
    const c = cleanNode(child);
    if (c) tmp.appendChild(c);
  });

  return tmp.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isPreviewMode, setIsPreviewMode] = React.useState(false);
  // Upload state for user feedback
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [uploadError, setUploadError] = React.useState("");

  const [isLinkOpen, setIsLinkOpen] = React.useState(false);
  const [isVideoOpen, setIsVideoOpen] = React.useState(false);
  const [isImageOpen, setIsImageOpen] = React.useState(false);

  const [activeStates, setActiveStates] = React.useState({
    bold: false, italic: false, underline: false, strikethrough: false,
    code: false, h1: false, h2: false, h3: false, blockquote: false,
    ul: false, ol: false, justifyLeft: false, justifyCenter: false, justifyRight: false,
  });

  const lastMarkdownRef = React.useRef(value);
  const [history, setHistory] = React.useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = React.useState(0);

  const pushState = (newMarkdown: string) => {
    if (newMarkdown === history[historyIndex]) return;
    const next = history.slice(0, historyIndex + 1);
    next.push(newMarkdown);
    setHistory(next);
    setHistoryIndex(next.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const i = historyIndex - 1;
    setHistoryIndex(i);
    const md = history[i];
    if (editorRef.current) editorRef.current.innerHTML = markdownToHtml(md);
    lastMarkdownRef.current = md;
    onChange(md);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const i = historyIndex + 1;
    setHistoryIndex(i);
    const md = history[i];
    if (editorRef.current) editorRef.current.innerHTML = markdownToHtml(md);
    lastMarkdownRef.current = md;
    onChange(md);
  };

  // Sync external value into editor only when it actually changed from outside
  React.useEffect(() => {
    if (editorRef.current && value !== lastMarkdownRef.current) {
      editorRef.current.innerHTML = markdownToHtml(value);
      lastMarkdownRef.current = value;
    }
  }, [value]);

  React.useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = markdownToHtml(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerChange = () => {
    if (!editorRef.current) return;
    const raw = editorRef.current.innerHTML;
    const html = sanitizeHtml(raw);
    if (["<p><br></p>", "<p></p>", "", "<br>"].includes(html)) {
      lastMarkdownRef.current = "";
      onChange(""); pushState(""); return;
    }
    const md = htmlToMarkdown(html);
    lastMarkdownRef.current = md;
    onChange(md); pushState(md);
  };

  // ── Inline style toggling ──────────────────────────────────────────────────

  const toggleInlineStyle = (tag: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    let parent: Node | null = range.commonAncestorContainer;
    if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;

    let isWrapped = false;
    let wrappedNode: HTMLElement | null = null;
    let cur: Node | null = parent;
    while (cur && cur !== editorRef.current) {
      if (cur.nodeName.toLowerCase() === tag) { isWrapped = true; wrappedNode = cur as HTMLElement; break; }
      cur = cur.parentNode;
    }

    if (isWrapped && wrappedNode) {
      const frag = document.createDocumentFragment();
      while (wrappedNode.firstChild) frag.appendChild(wrappedNode.firstChild);
      wrappedNode.parentNode?.replaceChild(frag, wrappedNode);
    } else {
      const wrapper = document.createElement(tag);
      if (tag === "code") {
        wrapper.style.cssText =
          "color:#00d9ff;background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.15);padding:2px 5px;border-radius:4px;font-family:monospace;";
      }
      if (range.collapsed) {
        wrapper.innerHTML = "&#8203;";
        range.insertNode(wrapper);
        const nr = document.createRange();
        nr.setStart(wrapper.firstChild!, 1);
        nr.collapse(true);
        sel.removeAllRanges(); sel.addRange(nr);
      } else {
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);
      }
    }
    triggerChange();
  };

  const toggleBlockStyle = (tag: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let container: Node | null = range.commonAncestorContainer;
    while (container && container !== editorRef.current) {
      if (container.nodeType === Node.ELEMENT_NODE &&
          ["p","h1","h2","h3","blockquote","div"].includes(container.nodeName.toLowerCase())) break;
      container = container.parentNode;
    }

    const BLOCK_STYLES: Record<string, string> = {
      blockquote: "border-left:2px solid rgba(251,191,36,0.7);background:rgba(251,191,36,0.05);padding:10px 16px;margin:16px 0;border-radius:0 6px 6px 0;font-style:italic;",
      h1: "color:#fff;font-size:24px;font-weight:700;margin:24px 0 12px;line-height:1.3;",
      h2: "color:#fff;font-size:20px;font-weight:700;margin:20px 0 10px;line-height:1.3;",
      h3: "color:#fff;font-size:18px;font-weight:600;margin:16px 0 8px;line-height:1.3;",
      p:  "margin:12px 0;line-height:1.75;font-size:14px;color:rgba(255,255,255,0.7);",
    };

    if (!container || container === editorRef.current) {
      const block = document.createElement(tag);
      if (BLOCK_STYLES[tag]) block.style.cssText = BLOCK_STYLES[tag];
      block.appendChild(range.extractContents());
      range.insertNode(block);
    } else {
      const el = container as HTMLElement;
      const newBlock = document.createElement(tag);
      if (BLOCK_STYLES[tag]) newBlock.style.cssText = BLOCK_STYLES[tag];
      newBlock.innerHTML = el.innerHTML;
      el.parentNode?.replaceChild(newBlock, el);
    }
    triggerChange();
  };

  const toggleList = (listType: "ul" | "ol") => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let container: Node | null = range.commonAncestorContainer;
    while (container && container !== editorRef.current) {
      if (container.nodeType === Node.ELEMENT_NODE &&
          ["p","h1","h2","h3","blockquote","div","ul","ol","li"].includes(container.nodeName.toLowerCase())) break;
      container = container.parentNode;
    }

    const listStyle = (t: "ul" | "ol") =>
      `padding-left:1.5rem;margin:12px 0;list-style:${t === "ul" ? "disc" : "decimal"} inside;`;

    if (container && ["ul","ol"].includes(container.nodeName.toLowerCase())) {
      // Toggle off — convert list items back to paragraphs
      const list = container as HTMLElement;
      const frag = document.createDocumentFragment();
      Array.from(list.children).forEach((li) => {
        const p = document.createElement("p");
        p.style.cssText = "margin:12px 0;line-height:1.75;font-size:14px;color:rgba(255,255,255,0.7);";
        p.innerHTML = li.innerHTML;
        frag.appendChild(p);
      });
      list.parentNode?.replaceChild(frag, list);
    } else if (container && container.nodeName.toLowerCase() === "li") {
      const li = container as HTMLElement;
      const list = li.parentNode as HTMLElement;
      if (list.nodeName.toLowerCase() === listType) {
        // Same type — toggle off
        const frag = document.createDocumentFragment();
        Array.from(list.children).forEach((child) => {
          const p = document.createElement("p");
          p.style.cssText = "margin:12px 0;line-height:1.75;font-size:14px;color:rgba(255,255,255,0.7);";
          p.innerHTML = child.innerHTML;
          frag.appendChild(p);
        });
        list.parentNode?.replaceChild(frag, list);
      } else {
        // Switch type
        const newList = document.createElement(listType);
        newList.style.cssText = listStyle(listType);
        newList.innerHTML = list.innerHTML;
        list.parentNode?.replaceChild(newList, list);
      }
    } else {
      const block = (container && container !== editorRef.current) ? (container as HTMLElement) : null;
      const list = document.createElement(listType);
      list.style.cssText = listStyle(listType);
      const li = document.createElement("li");
      li.style.cssText = "margin-bottom:4px;";
      if (block) {
        li.innerHTML = block.innerHTML;
        list.appendChild(li);
        block.parentNode?.replaceChild(list, block);
      } else {
        li.appendChild(range.extractContents());
        list.appendChild(li);
        range.insertNode(list);
      }
    }
    triggerChange();
  };

  const toggleAlignment = (align: "left" | "center" | "right") => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let container: Node | null = range.commonAncestorContainer;
    while (container && container !== editorRef.current) {
      if (container.nodeType === Node.ELEMENT_NODE &&
          ["p","h1","h2","h3","blockquote","div","ul","ol","li"].includes(container.nodeName.toLowerCase())) break;
      container = container.parentNode;
    }
    if (container && container !== editorRef.current) {
      (container as HTMLElement).style.textAlign = align === "left" ? "" : align;
    }
    triggerChange();
  };

  const insertHtmlAtCursor = (html: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node: Node | null;
    while ((node = tmp.firstChild)) frag.appendChild(node);
    range.insertNode(frag);
    sel.collapseToEnd();
    triggerChange();
  };

  const executeCommand = (command: string, value = "") => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (command === "bold")          toggleInlineStyle("strong");
    else if (command === "italic")   toggleInlineStyle("em");
    else if (command === "underline") toggleInlineStyle("u");
    else if (command === "strikeThrough") toggleInlineStyle("del");
    else if (command === "formatBlock") {
      if (value === "code") toggleInlineStyle("code");
      else if (["h1","h2","h3","blockquote"].includes(value)) toggleBlockStyle(value);
    }
    else if (command === "insertUnorderedList") toggleList("ul");
    else if (command === "insertOrderedList")   toggleList("ol");
    else if (command === "insertHorizontalRule") {
      insertHtmlAtCursor('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;" /><p><br></p>');
    }
    else if (command === "justifyLeft")   toggleAlignment("left");
    else if (command === "justifyCenter") toggleAlignment("center");
    else if (command === "justifyRight")  toggleAlignment("right");
    else if (command === "undo") handleUndo();
    else if (command === "redo") handleRedo();
    updateActiveStates();
  };

  const updateActiveStates = () => {
    if (!editorRef.current) return;
    const isTagActive = (tag: string) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeName.toLowerCase() === tag) return true;
        node = node.parentNode;
      }
      return false;
    };
    const isAlignActive = (align: string) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).style.textAlign === align) return true;
        node = node.parentNode;
      }
      return false;
    };
    setActiveStates({
      bold:         isTagActive("strong") || isTagActive("b"),
      italic:       isTagActive("em")     || isTagActive("i"),
      underline:    isTagActive("u"),
      strikethrough:isTagActive("del")    || isTagActive("strike") || isTagActive("s"),
      code:         isTagActive("code"),
      h1:           isTagActive("h1"), h2: isTagActive("h2"), h3: isTagActive("h3"),
      blockquote:   isTagActive("blockquote"),
      ul:           isTagActive("ul"), ol: isTagActive("ol"),
      justifyLeft:  isAlignActive("left"),
      justifyCenter:isAlignActive("center"),
      justifyRight: isAlignActive("right"),
    });
  };

  // ── Image upload helper — uploads file, inserts Cloudinary URL ────────────

  const insertImageFromFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPEG, PNG, WebP, GIF).");
      setTimeout(() => setUploadError(""), 4000);
      return;
    }
    setUploadingImage(true);
    setUploadError("");
    try {
      const url = await uploadContentImage(file);
      const imgHtml = `<img src="${url}" alt="${file.name}" style="${IMG_STYLE}" /><p><br></p>`;
      insertHtmlAtCursor(imgHtml);
    } catch (err: any) {
      setUploadError("Image upload failed. Check your connection and try again.");
      setTimeout(() => setUploadError(""), 5000);
      console.error("Content image upload error:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod) {
      if (e.key === "b" || e.key === "B") { e.preventDefault(); executeCommand("bold"); }
      else if (e.key === "i" || e.key === "I") { e.preventDefault(); executeCommand("italic"); }
      else if (e.key === "u" || e.key === "U") { e.preventDefault(); executeCommand("underline"); }
      else if (e.key === "k" || e.key === "K") { e.preventDefault(); setIsLinkOpen(true); }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      insertHtmlAtCursor("&nbsp;&nbsp;&nbsp;&nbsp;");
    }
  };

  // ── Paste handling — strip external styles, upload pasted images ───────────

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) await insertImageFromFile(file);
          return;
        }
      }
    }
    // Plain text paste — strip external styles
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") || "";
    const paragraphs = text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length > 0) {
      const html = paragraphs
        .map((p) => `<p style="margin:12px 0;line-height:1.75;font-size:14px;color:rgba(255,255,255,0.7);">${p}</p>`)
        .join("");
      insertHtmlAtCursor(html);
    }
  };

  // ── Drag and drop images directly onto editor ─────────────────────────────

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      await insertImageFromFile(file);
    }
  };

  // ── Modal callbacks ───────────────────────────────────────────────────────

  const handleLinkSubmit = (url: string, label?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const text = label || range.toString() || url;
      const a = document.createElement("a");
      a.href = url; a.textContent = text; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.style.cssText = "color:#00d9ff;text-decoration:underline;font-weight:500;";
      range.deleteContents(); range.insertNode(a);
      sel.collapseToEnd();
    }
    triggerChange();
  };

  const handleVideoSubmit = (url: string) => {
    const embedUrl = getYouTubeEmbedUrl(url);
    if (embedUrl) {
      insertHtmlAtCursor(`
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:8px;margin:16px 0;border:1px solid rgba(255,255,255,0.08);">
          <iframe src="${embedUrl}" title="YouTube Video" frameborder="0"
            allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen
            style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
        </div><p><br></p>`);
    } else {
      insertHtmlAtCursor(`
        <video controls style="max-width:100%;border-radius:8px;margin:16px 0;display:block;border:1px solid rgba(255,255,255,0.08);">
          <source src="${url}" type="video/mp4">Your browser does not support the video tag.
        </video><p><br></p>`);
    }
  };

  // MediaUploader callbacks — file upload to Cloudinary, URL insert direct
  const handleImageSelect = async (_blobUrl: string, _name: string, file?: File) => {
    // The MediaUploader passes the blob URL; we ignore it and use the File directly.
    // If file isn't passed, fall back to blob (shouldn't happen with updated MediaUploader).
    if (file) {
      await insertImageFromFile(file);
    } else {
      // Fallback: direct blob insert (will work in editor preview but won't persist)
      const imgHtml = `<img src="${_blobUrl}" alt="${_name}" style="${IMG_STYLE}" /><p><br></p>`;
      insertHtmlAtCursor(imgHtml);
    }
  };

  const handleImageUrlInsert = (url: string) => {
    const imgHtml = `<img src="${url}" alt="image" style="${IMG_STYLE}" /><p><br></p>`;
    insertHtmlAtCursor(imgHtml);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "relative rounded-lg border border-white/10 bg-white/[0.01] transition-all flex flex-col",
        dragActive && "border-steami-cyan/50 bg-steami-cyan/[0.02]",
        isFullscreen && "fixed inset-4 z-50 bg-[#020617] border border-white/15 shadow-2xl flex flex-col"
      )}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-steami-cyan shadow-[0_0_8px_#00d9ff]" />
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            Publishing Workspace
          </span>
          {uploadingImage && (
            <span className="flex items-center gap-1 text-[10px] text-steami-cyan font-mono ml-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading image…
            </span>
          )}
          {uploadError && (
            <span className="text-[10px] text-steami-red font-mono ml-2">{uploadError}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all text-muted-foreground hover:text-white hover:bg-white/[0.05] border border-white/5"
          >
            {isPreviewMode ? <><EyeOff className="h-3.5 w-3.5" /> Edit</> : <><Eye className="h-3.5 w-3.5" /> Preview</>}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded text-muted-foreground hover:text-white hover:bg-white/[0.05] border border-white/5 transition-all"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!isPreviewMode ? (
        <>
          <RichTextToolbar
            onCommand={executeCommand}
            activeStates={activeStates}
            onInsertLink={() => setIsLinkOpen(true)}
            onInsertImage={() => setIsImageOpen(true)}
            onInsertVideo={() => setIsVideoOpen(true)}
          />

          <div className="relative flex-1 flex flex-col p-4 min-h-[320px]">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={triggerChange}
              onKeyDown={handleKeyDown}
              onKeyUp={updateActiveStates}
              onMouseUp={updateActiveStates}
              onPaste={handlePaste}
              className={cn(
                "prose prose-invert prose-sm max-w-none flex-1 outline-none text-foreground text-[14px] leading-[1.75] overflow-y-auto selection:bg-steami-cyan/20 selection:text-steami-cyan pr-2",
                isFullscreen ? "max-h-[calc(100vh-140px)]" : "max-h-[480px]"
              )}
              style={{ fontFamily: "inherit" }}
            />
            {dragActive && (
              <div className="absolute inset-0 bg-steami-cyan/5 border-2 border-dashed border-steami-cyan/40 rounded-b-lg flex flex-col items-center justify-center pointer-events-none animate-pulse">
                <span className="text-[12px] font-mono tracking-widest text-steami-cyan uppercase">
                  Drop image to upload & insert
                </span>
              </div>
            )}
            {uploadingImage && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-b-lg pointer-events-none">
                <div className="flex items-center gap-2 bg-[#0b1426] border border-white/10 rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-steami-cyan" />
                  <span className="text-[12px] font-mono text-steami-cyan">Uploading to Cloudinary…</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Preview — render saved markdown as HTML */
        <div
          className={cn(
            "prose prose-invert prose-sm max-w-none p-6 overflow-y-auto bg-[#02050f] rounded-b-lg border-t border-white/5 text-[14px] leading-[1.8]",
            isFullscreen ? "max-h-[calc(100vh-80px)]" : "min-h-[320px] max-h-[480px]"
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(value)) }}
        />
      )}

      {/* Modals */}
      <EmbedModal
        isOpen={isLinkOpen} onClose={() => setIsLinkOpen(false)}
        onSubmit={handleLinkSubmit} title="Insert Link"
        placeholder="https://example.com" showLabelInput labelPlaceholder="Text to display"
      />
      <EmbedModal
        isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)}
        onSubmit={handleVideoSubmit} title="Embed Video"
        placeholder="Enter YouTube URL or MP4 URL"
      />
      <MediaUploader
        isOpen={isImageOpen} onClose={() => setIsImageOpen(false)}
        onImageSelect={handleImageSelect} onUrlInsert={handleImageUrlInsert}
      />
    </div>
  );
}
