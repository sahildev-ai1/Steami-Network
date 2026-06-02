import * as React from "react";
import { RichTextToolbar } from "./RichTextToolbar";
import { EmbedModal } from "./EmbedModal";
import { MediaUploader } from "./MediaUploader";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Maximize2, Minimize2, Trash2 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML <-> Markdown Utilities
// ─────────────────────────────────────────────────────────────────────────────

function inlineMarkdownToHtml(text: string): string {
  let html = text;

  // Images: ![alt](url)
  html = html.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 8px; margin: 12px 0; display: block; border: 1px solid rgba(255,255,255,0.08);" />'
  );

  // Links: [text](url)
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" style="color: #00d9ff; text-decoration: underline; font-weight: 500;" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // Underline: <u>text</u>
  html = html.replace(/<u>(.*?)<\/u>/g, "<u>$1</u>");

  // Inline Code: `code`
  html = html.replace(
    /`(.*?)`/g,
    '<code style="color: #00d9ff; background: rgba(0,217,255,0.08); border: 1px solid rgba(0,217,255,0.15); padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">$1</code>'
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
    if (currentListType && currentList.length > 0) {
      const items = currentList
        .map((li) => `<li>${inlineMarkdownToHtml(li)}</li>`)
        .join("");
      htmlBlocks.push(`<${currentListType} class="list-decimal pl-6 my-3 space-y-1 text-muted-foreground">${items}</${currentListType}>`);
      currentList = [];
      currentListType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      closeList();
      htmlBlocks.push('<hr class="border-white/10 my-6" />');
      continue;
    }

    // Direct Embedded HTML (e.g. YouTube iframes)
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
      let classes = "";
      if (level === 1) classes = "font-serif text-[24px] font-bold text-white mt-6 mb-3 leading-tight";
      else if (level === 2) classes = "font-serif text-[20px] font-bold text-white mt-5 mb-2.5 leading-tight";
      else classes = "font-serif text-[18px] font-semibold text-white mt-4 mb-2 leading-tight";
      
      htmlBlocks.push(`<h${level} class="${classes}">${content}</h${level}>`);
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeList();
      const content = inlineMarkdownToHtml(quoteMatch[1]);
      htmlBlocks.push(
        `<blockquote class="border-l-2 border-steami-gold bg-steami-gold/5 py-2.5 px-4 my-4 rounded-r-lg font-medium italic text-foreground/90">${content}</blockquote>`
      );
      continue;
    }

    // Unordered List
    const ulMatch = line.match(/^[\s]*[-*]\s+(.*)$/);
    if (ulMatch) {
      if (currentListType === "ol") closeList();
      currentListType = "ul";
      currentList.push(ulMatch[1]);
      continue;
    }

    // Ordered List
    const olMatch = line.match(/^[\s]*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (currentListType === "ul") closeList();
      currentListType = "ol";
      currentList.push(olMatch[1]);
      continue;
    }

    // Alignment wrapper
    if (
      trimmed.startsWith('<div align="center">') ||
      trimmed.startsWith('<div style="text-align: center;">')
    ) {
      closeList();
      let innerContent = "";
      if (trimmed.endsWith("</div>")) {
        innerContent = trimmed.substring(
          trimmed.indexOf(">") + 1,
          trimmed.lastIndexOf("</div")
        );
        htmlBlocks.push(
          `<div style="text-align: center; margin: 8px 0;">${inlineMarkdownToHtml(
            innerContent
          )}</div>`
        );
      } else {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().endsWith("</div>")) {
          innerContent += lines[j] + "\n";
          j++;
        }
        i = j;
        htmlBlocks.push(
          `<div style="text-align: center; margin: 8px 0;">${inlineMarkdownToHtml(
            innerContent.trim()
          )}</div>`
        );
      }
      continue;
    }

    if (
      trimmed.startsWith('<div align="right">') ||
      trimmed.startsWith('<div style="text-align: right;">')
    ) {
      closeList();
      let innerContent = "";
      if (trimmed.endsWith("</div>")) {
        innerContent = trimmed.substring(
          trimmed.indexOf(">") + 1,
          trimmed.lastIndexOf("</div")
        );
        htmlBlocks.push(
          `<div style="text-align: right; margin: 8px 0;">${inlineMarkdownToHtml(
            innerContent
          )}</div>`
        );
      } else {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().endsWith("</div>")) {
          innerContent += lines[j] + "\n";
          j++;
        }
        i = j;
        htmlBlocks.push(
          `<div style="text-align: right; margin: 8px 0;">${inlineMarkdownToHtml(
            innerContent.trim()
          )}</div>`
        );
      }
      continue;
    }

    // Default Paragraph
    closeList();
    htmlBlocks.push(
      `<p class="my-3 leading-[1.75] text-[14px] text-muted-foreground">${inlineMarkdownToHtml(
        line
      )}</p>`
    );
  }

  closeList();
  return htmlBlocks.join("\n");
}

function htmlToMarkdown(html: string): string {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  let markdown = "";

  const convertNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    let childrenMd = "";
    element.childNodes.forEach((child) => {
      childrenMd += convertNode(child);
    });

    const tag = element.tagName.toLowerCase();
    switch (tag) {
      case "strong":
      case "b":
        return childrenMd.trim() ? `**${childrenMd.trim()}**` : "";
      case "em":
      case "i":
        return childrenMd.trim() ? `*${childrenMd.trim()}*` : "";
      case "u":
        return childrenMd.trim() ? `<u>${childrenMd.trim()}</u>` : "";
      case "strike":
      case "s":
      case "del":
        return childrenMd.trim() ? `~~${childrenMd.trim()}~~` : "";
      case "code":
        return childrenMd.trim() ? `\`${childrenMd.trim()}\`` : "";
      case "h1":
        return `\n# ${childrenMd.trim()}\n\n`;
      case "h2":
        return `\n## ${childrenMd.trim()}\n\n`;
      case "h3":
        return `\n### ${childrenMd.trim()}\n\n`;
      case "blockquote":
        return `\n> ${childrenMd.trim().replace(/\n/g, "\n> ")}\n\n`;
      case "ul":
        return `\n${childrenMd}\n`;
      case "ol":
        return `\n${childrenMd}\n`;
      case "li": {
        const parentTag = element.parentElement?.tagName.toLowerCase();
        if (parentTag === "ol") {
          const index =
            Array.from(element.parentElement.children).indexOf(element) + 1;
          return `${index}. ${childrenMd.trim()}\n`;
        }
        return `- ${childrenMd.trim()}\n`;
      }
      case "p":
        return childrenMd.trim() ? `${childrenMd.trim()}\n\n` : "";
      case "a":
        return `[${childrenMd.trim() || element.getAttribute("href")}](${
          element.getAttribute("href") || ""
        })`;
      case "img":
        return `![${element.getAttribute("alt") || "image"}](${
          element.getAttribute("src") || ""
        })`;
      case "iframe":
      case "video":
        // Preserve direct iframe embeds (YouTube) and video controls
        return `\n${element.outerHTML}\n\n`;
      case "hr":
        return `\n---\n\n`;
      case "br":
        return "\n";
      case "div": {
        const textAlign =
          element.style.textAlign || element.getAttribute("align");
        if (textAlign === "center") {
          return `\n<div align="center">\n\n${childrenMd.trim()}\n\n</div>\n\n`;
        } else if (textAlign === "right") {
          return `\n<div align="right">\n\n${childrenMd.trim()}\n\n</div>\n\n`;
        }
        return childrenMd.trim() ? `${childrenMd.trim()}\n\n` : "";
      }
      default:
        return childrenMd;
    }
  };

  tempDiv.childNodes.forEach((node) => {
    markdown += convertNode(node);
  });

  return markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function getYouTubeEmbedUrl(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : null;
}

function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  const allowedTags = new Set([
    "p", "strong", "b", "em", "i", "h1", "h2", "h3", "ul", "ol", "li",
    "blockquote", "code", "a", "img", "iframe", "span", "div", "hr", "br", "del", "u"
  ]);

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (!allowedTags.has(tagName)) {
      return null;
    }

    if (tagName === "iframe") {
      const src = element.getAttribute("src") || "";
      if (!src.startsWith("https://www.youtube.com/") && !src.startsWith("https://youtube.com/")) {
        return null;
      }
    }

    const cleanElement = document.createElement(tagName);

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value;

      if (attrName.startsWith("on")) {
        continue;
      }

      if ((attrName === "href" || attrName === "src") && 
          (attrValue.trim().toLowerCase().startsWith("javascript:") || 
           attrValue.trim().toLowerCase().startsWith("data:"))) {
        continue;
      }

      if (attrName === "style") {
        if (!attrValue.toLowerCase().includes("expression") && !attrValue.toLowerCase().includes("url(")) {
          cleanElement.setAttribute(attrName, attrValue);
        }
      } else {
        cleanElement.setAttribute(attrName, attrValue);
      }
    }

    element.childNodes.forEach(child => {
      const cleanChild = cleanNode(child);
      if (cleanChild) {
        cleanElement.appendChild(cleanChild);
      }
    });

    return cleanElement;
  };

  const fragment = doc.createDocumentFragment();
  doc.body.childNodes.forEach(child => {
    const cleanChild = cleanNode(child);
    if (cleanChild) {
      fragment.appendChild(cleanChild);
    }
  });

  const tempDiv = document.createElement("div");
  tempDiv.appendChild(fragment);
  return tempDiv.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// Master RichTextEditor Component
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

  // Modal Dialog states
  const [isLinkOpen, setIsLinkOpen] = React.useState(false);
  const [isVideoOpen, setIsVideoOpen] = React.useState(false);
  const [isImageOpen, setIsImageOpen] = React.useState(false);

  // Active toolbar formats states
  const [activeStates, setActiveStates] = React.useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    h1: false,
    h2: false,
    h3: false,
    blockquote: false,
    ul: false,
    ol: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
  });

  // Track the Markdown value that we internally updated.
  // This helps prevent setting innerHTML infinitely on every change event.
  const lastMarkdownRef = React.useRef(value);

  // Undo/Redo State History
  const [history, setHistory] = React.useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = React.useState(0);

  const pushState = (newMarkdown: string) => {
    if (newMarkdown === history[historyIndex]) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newMarkdown);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      const markdown = history[prevIndex];
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(markdown);
      }
      lastMarkdownRef.current = markdown;
      onChange(markdown);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const markdown = history[nextIndex];
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(markdown);
      }
      lastMarkdownRef.current = markdown;
      onChange(markdown);
    }
  };

  // Initial Content Load
  React.useEffect(() => {
    if (editorRef.current && value !== lastMarkdownRef.current) {
      editorRef.current.innerHTML = markdownToHtml(value);
      lastMarkdownRef.current = value;
    }
  }, [value]);

  // Load placeholder style or default text on startup
  React.useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = markdownToHtml(value);
    }
  }, []);

  const triggerChange = () => {
    if (!editorRef.current) return;
    const rawHtml = editorRef.current.innerHTML;
    const html = sanitizeHtml(rawHtml);
    
    // If the editor only contains an empty paragraph or breaks, serialize as empty
    if (html === "<p><br></p>" || html === "<p></p>" || html === "" || html === "<br>") {
      lastMarkdownRef.current = "";
      onChange("");
      pushState("");
      return;
    }
    const markdown = htmlToMarkdown(html);
    lastMarkdownRef.current = markdown;
    onChange(markdown);
    pushState(markdown);
  };

  const toggleInlineStyle = (tag: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const elementTag = tag.toLowerCase();

    // Check if selection is already wrapped in this tag
    let parentNode: Node | null = range.commonAncestorContainer;
    if (parentNode.nodeType === Node.TEXT_NODE) {
      parentNode = parentNode.parentNode;
    }

    let isWrapped = false;
    let wrappedNode: HTMLElement | null = null;

    let current: Node | null = parentNode;
    while (current && current !== editorRef.current) {
      if (current.nodeName.toLowerCase() === elementTag) {
        isWrapped = true;
        wrappedNode = current as HTMLElement;
        break;
      }
      current = current.parentNode;
    }

    if (isWrapped && wrappedNode) {
      // Unwrap the tag
      const parentOfWrapped = wrappedNode.parentNode;
      if (parentOfWrapped) {
        const frag = document.createDocumentFragment();
        while (wrappedNode.firstChild) {
          frag.appendChild(wrappedNode.firstChild);
        }
        parentOfWrapped.replaceChild(frag, wrappedNode);
      }
    } else {
      // Wrap the selection content
      const wrapper = document.createElement(tag);
      
      if (tag === "code") {
        wrapper.style.color = "#00d9ff";
        wrapper.style.background = "rgba(0,217,255,0.08)";
        wrapper.style.border = "1px solid rgba(0,217,255,0.15)";
        wrapper.style.padding = "2px 5px";
        wrapper.style.borderRadius = "4px";
        wrapper.style.fontFamily = "monospace";
      }

      if (range.collapsed) {
        wrapper.innerHTML = "&#8203;"; // Zero-width space
        range.insertNode(wrapper);
        
        const newRange = document.createRange();
        newRange.setStart(wrapper.firstChild!, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);
      }
    }
    triggerChange();
  };

  const toggleBlockStyle = (tag: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let container: Node | null = range.commonAncestorContainer;
    
    while (container && container !== editorRef.current) {
      if (container.nodeType === Node.ELEMENT_NODE) {
        const name = container.nodeName.toLowerCase();
        if (["p", "h1", "h2", "h3", "blockquote", "div"].includes(name)) {
          break;
        }
      }
      container = container.parentNode;
    }

    if (!container || container === editorRef.current) {
      const block = document.createElement(tag);
      if (tag === "blockquote") {
        block.className = "border-l-2 border-steami-gold bg-steami-gold/5 py-2.5 px-4 my-4 rounded-r-lg font-medium italic text-foreground/90";
      } else if (tag === "h1") {
        block.className = "font-serif text-[24px] font-bold text-white mt-6 mb-3 leading-tight";
      } else if (tag === "h2") {
        block.className = "font-serif text-[20px] font-bold text-white mt-5 mb-2.5 leading-tight";
      } else if (tag === "h3") {
        block.className = "font-serif text-[18px] font-semibold text-white mt-4 mb-2 leading-tight";
      }
      block.appendChild(range.extractContents());
      range.insertNode(block);
    } else {
      const element = container as HTMLElement;
      const newBlock = document.createElement(tag);
      
      if (tag === "blockquote") {
        newBlock.className = "border-l-2 border-steami-gold bg-steami-gold/5 py-2.5 px-4 my-4 rounded-r-lg font-medium italic text-foreground/90";
      } else if (tag === "h1") {
        newBlock.className = "font-serif text-[24px] font-bold text-white mt-6 mb-3 leading-tight";
      } else if (tag === "h2") {
        newBlock.className = "font-serif text-[20px] font-bold text-white mt-5 mb-2.5 leading-tight";
      } else if (tag === "h3") {
        newBlock.className = "font-serif text-[18px] font-semibold text-white mt-4 mb-2 leading-tight";
      } else if (tag === "p") {
        newBlock.className = "my-3 leading-[1.75] text-[14px] text-muted-foreground";
      }

      newBlock.innerHTML = element.innerHTML;
      element.parentNode?.replaceChild(newBlock, element);
    }
    triggerChange();
  };

  const toggleList = (listType: "ul" | "ol") => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let container: Node | null = range.commonAncestorContainer;
    
    while (container && container !== editorRef.current) {
      if (container.nodeType === Node.ELEMENT_NODE) {
        const name = container.nodeName.toLowerCase();
        if (["p", "h1", "h2", "h3", "blockquote", "div", "ul", "ol", "li"].includes(name)) {
          break;
        }
      }
      container = container.parentNode;
    }

    if (container && (container.nodeName.toLowerCase() === "ul" || container.nodeName.toLowerCase() === "ol")) {
      const list = container as HTMLElement;
      const parent = list.parentNode;
      const fragment = document.createDocumentFragment();
      Array.from(list.children).forEach((li) => {
        const p = document.createElement("p");
        p.className = "my-3 leading-[1.75] text-[14px] text-muted-foreground";
        p.innerHTML = li.innerHTML;
        fragment.appendChild(p);
      });
      parent?.replaceChild(fragment, list);
    } else if (container && container.nodeName.toLowerCase() === "li") {
      const li = container as HTMLElement;
      const list = li.parentNode as HTMLElement;
      if (list.nodeName.toLowerCase() === listType) {
        const parent = list.parentNode;
        const fragment = document.createDocumentFragment();
        Array.from(list.children).forEach((child) => {
          const p = document.createElement("p");
          p.className = "my-3 leading-[1.75] text-[14px] text-muted-foreground";
          p.innerHTML = child.innerHTML;
          fragment.appendChild(p);
        });
        parent?.replaceChild(fragment, list);
      } else {
        const newList = document.createElement(listType);
        newList.className = listType === "ul" 
          ? "list-disc pl-6 my-3 space-y-1 text-muted-foreground"
          : "list-decimal pl-6 my-3 space-y-1 text-muted-foreground";
        newList.innerHTML = list.innerHTML;
        list.parentNode?.replaceChild(newList, list);
      }
    } else {
      const block = (container && container !== editorRef.current) ? (container as HTMLElement) : null;
      const list = document.createElement(listType);
      list.className = listType === "ul" 
        ? "list-disc pl-6 my-3 space-y-1 text-muted-foreground"
        : "list-decimal pl-6 my-3 space-y-1 text-muted-foreground";
      
      const li = document.createElement("li");
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

  const toggleAlignment = (alignment: "left" | "center" | "right") => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let container: Node | null = range.commonAncestorContainer;
    
    while (container && container !== editorRef.current) {
      if (container.nodeType === Node.ELEMENT_NODE) {
        const name = container.nodeName.toLowerCase();
        if (["p", "h1", "h2", "h3", "blockquote", "div", "ul", "ol", "li"].includes(name)) {
          break;
        }
      }
      container = container.parentNode;
    }

    if (container && container !== editorRef.current) {
      const element = container as HTMLElement;
      if (alignment === "left") {
        element.style.textAlign = "";
      } else {
        element.style.textAlign = alignment;
      }
    }
    triggerChange();
  };

  const insertDivider = () => {
    const hr = document.createElement("hr");
    hr.className = "border-white/10 my-6";
    insertHtmlAtCursor(hr.outerHTML);
  };

  const executeCommand = (command: string, value = "") => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();

    if (command === "bold") {
      toggleInlineStyle("strong");
    } else if (command === "italic") {
      toggleInlineStyle("em");
    } else if (command === "underline") {
      toggleInlineStyle("u");
    } else if (command === "strikeThrough") {
      toggleInlineStyle("del");
    } else if (command === "formatBlock") {
      if (value === "code") {
        toggleInlineStyle("code");
      } else if (value === "h1" || value === "h2" || value === "h3" || value === "blockquote") {
        toggleBlockStyle(value);
      }
    } else if (command === "insertUnorderedList") {
      toggleList("ul");
    } else if (command === "insertOrderedList") {
      toggleList("ol");
    } else if (command === "insertHorizontalRule") {
      insertDivider();
    } else if (command === "justifyLeft" || command === "justifyCenter" || command === "justifyRight") {
      const align = command.replace("justify", "").toLowerCase() as "left" | "center" | "right";
      toggleAlignment(align);
    } else if (command === "undo") {
      handleUndo();
    } else if (command === "redo") {
      handleRedo();
    }

    updateActiveStates();
  };

  const updateActiveStates = () => {
    if (!editorRef.current) return;
    
    const isElementActive = (tag: string) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeName.toLowerCase() === tag) return true;
        node = node.parentNode;
      }
      return false;
    };

    const isAlignActive = (align: string) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const style = (node as HTMLElement).style.textAlign;
          if (style === align) return true;
        }
        node = node.parentNode;
      }
      return false;
    };

    setActiveStates({
      bold: isElementActive("strong") || isElementActive("b"),
      italic: isElementActive("em") || isElementActive("i"),
      underline: isElementActive("u"),
      strikethrough: isElementActive("del") || isElementActive("strike") || isElementActive("s"),
      code: isElementActive("code"),
      h1: isElementActive("h1"),
      h2: isElementActive("h2"),
      h3: isElementActive("h3"),
      blockquote: isElementActive("blockquote"),
      ul: isElementActive("ul"),
      ol: isElementActive("ol"),
      justifyLeft: isAlignActive("left"),
      justifyCenter: isAlignActive("center"),
      justifyRight: isAlignActive("right"),
    });
  };

  const insertHtmlAtCursor = (html: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    
    const frag = document.createDocumentFragment();
    let node: Node | null;
    while ((node = tempDiv.firstChild)) {
      frag.appendChild(node);
    }
    
    range.insertNode(frag);
    selection.collapseToEnd();
    triggerChange();
  };

  // Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+K)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        executeCommand("bold");
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        executeCommand("italic");
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        executeCommand("underline");
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setIsLinkOpen(true);
      }
    }

    // Handle tab key in list or code blocks
    if (e.key === "Tab") {
      e.preventDefault();
      insertHtmlAtCursor("&nbsp;&nbsp;&nbsp;&nbsp;");
    }
  };

  // Paste image or rich text cleanly
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    let hasImage = false;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          hasImage = true;
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            try {
              const url = URL.createObjectURL(file);
              const imgHtml = `<img src="${url}" alt="${file.name}" style="max-width: 100%; border-radius: 8px; margin: 12px 0; display: block; border: 1px solid rgba(255,255,255,0.08);" />`;
              insertHtmlAtCursor(imgHtml);
            } catch (err) {
              console.error("Paste image failed", err);
            }
          }
          break;
        }
      }
    }

    // Default formatting sanitization to prevent copy-pasting ugly external styles
    if (!hasImage) {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") || "";
      const paragraphs = text
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      
      if (paragraphs.length > 0) {
        const html = paragraphs
          .map((p) => `<p class="my-3 leading-[1.75] text-[14px] text-muted-foreground">${p}</p>`)
          .join("");
        insertHtmlAtCursor(html);
      }
    }
  };

  // Drag and Drop files directly on the editor zone
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        try {
          const url = URL.createObjectURL(file);
          const imgHtml = `<img src="${url}" alt="${file.name}" style="max-width: 100%; border-radius: 8px; margin: 12px 0; display: block; border: 1px solid rgba(255,255,255,0.08);" />`;
          insertHtmlAtCursor(imgHtml);
        } catch (err) {
          console.error("Drop image failed", err);
        }
      }
    }
  };

  // Modals callbacks
  const handleLinkSubmit = (url: string, label?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const text = label || range.toString() || url;
      
      const linkElem = document.createElement("a");
      linkElem.href = url;
      linkElem.textContent = text;
      linkElem.style.color = "#00d9ff";
      linkElem.style.textDecoration = "underline";
      linkElem.style.fontWeight = "500";
      linkElem.target = "_blank";
      linkElem.rel = "noopener noreferrer";

      range.deleteContents();
      range.insertNode(linkElem);
      selection.collapseToEnd();
    }
    triggerChange();
  };

  const handleVideoSubmit = (url: string) => {
    const embedUrl = getYouTubeEmbedUrl(url);
    if (embedUrl) {
      // YouTube embed
      const iframeHtml = `
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 8px; margin: 16px 0; border: 1px solid rgba(255,255,255,0.08);">
          <iframe 
            src="${embedUrl}" 
            title="YouTube Video" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
          ></iframe>
        </div><p><br></p>
      `;
      insertHtmlAtCursor(iframeHtml);
    } else {
      // Direct HTML5 Video Tag
      const videoHtml = `
        <video controls style="max-width: 100%; border-radius: 8px; margin: 16px 0; display: block; border: 1px solid rgba(255,255,255,0.08);">
          <source src="${url}" type="video/mp4">
          Your browser does not support the video tag.
        </video><p><br></p>
      `;
      insertHtmlAtCursor(videoHtml);
    }
  };

  const handleImageSelect = (url: string, name: string) => {
    const imgHtml = `<img src="${url}" alt="${name}" style="max-width: 100%; border-radius: 8px; margin: 12px 0; display: block; border: 1px solid rgba(255,255,255,0.08);" />`;
    insertHtmlAtCursor(imgHtml);
  };

  const handleImageUrlInsert = (url: string) => {
    const imgHtml = `<img src="${url}" alt="image" style="max-width: 100%; border-radius: 8px; margin: 12px 0; display: block; border: 1px solid rgba(255,255,255,0.08);" />`;
    insertHtmlAtCursor(imgHtml);
  };

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
      {/* Editor Control Headers */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-steami-cyan shadow-[0_0_8px_#00d9ff]" />
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            Publishing Workspace
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Preview Toggle */}
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all text-muted-foreground hover:text-white hover:bg-white/[0.05] border border-white/5"
            title={isPreviewMode ? "Edit Mode" : "Preview Mode"}
          >
            {isPreviewMode ? (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Edit
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Preview
              </>
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded text-muted-foreground hover:text-white hover:bg-white/[0.05] border border-white/5 transition-all"
            title={isFullscreen ? "Minimize" : "Maximize"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {!isPreviewMode ? (
        <>
          {/* Rich Text Toolbar */}
          <RichTextToolbar
            onCommand={executeCommand}
            activeStates={activeStates}
            onInsertLink={() => setIsLinkOpen(true)}
            onInsertImage={() => setIsImageOpen(true)}
            onInsertVideo={() => setIsVideoOpen(true)}
          />

          {/* contentEditable Zone */}
          <div className="relative flex-1 flex flex-col p-4 min-h-[320px]">
            <div
              ref={editorRef}
              contentEditable
              onInput={triggerChange}
              onKeyDown={handleKeyDown}
              onKeyUp={updateActiveStates}
              onMouseUp={updateActiveStates}
              className={cn(
                "prose prose-invert prose-sm max-w-none flex-1 outline-none text-foreground text-[14px] leading-[1.75] overflow-y-auto selection:bg-steami-cyan/20 selection:text-steami-cyan pr-2",
                isFullscreen ? "max-h-[calc(100vh-140px)]" : "max-h-[480px]"
              )}
              style={{
                fontFamily: "inherit",
              }}
            />
            {/* Visual Dropzone Overlay */}
            {dragActive && (
              <div className="absolute inset-0 bg-steami-cyan/5 border-2 border-dashed border-steami-cyan/40 rounded-b-lg flex flex-col items-center justify-center pointer-events-none animate-pulse">
                <span className="text-[12px] font-mono tracking-widest text-steami-cyan uppercase">
                  Drop image to insert in editor
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        /* HTML Live Rendering Preview Mode with Sanitization */
        <div
          className={cn(
            "prose prose-invert prose-sm max-w-none p-6 overflow-y-auto bg-[#02050f] rounded-b-lg border-t border-white/5 text-[14px] leading-[1.8]",
            isFullscreen ? "max-h-[calc(100vh-80px)]" : "min-h-[320px] max-h-[480px]"
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(value)) }}
        />
      )}

      {/* Insert Link Dialog Modal */}
      <EmbedModal
        isOpen={isLinkOpen}
        onClose={() => setIsLinkOpen(false)}
        onSubmit={handleLinkSubmit}
        title="Insert Link"
        placeholder="https://example.com"
        showLabelInput
        labelPlaceholder="Text to display"
      />

      {/* Insert Video Dialog Modal */}
      <EmbedModal
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        onSubmit={handleVideoSubmit}
        title="Embed Video"
        placeholder="Enter YouTube URL or MP4 URL"
      />

      {/* Insert Image Drag & Drop / URL Modal */}
      <MediaUploader
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
        onImageSelect={handleImageSelect}
        onUrlInsert={handleImageUrlInsert}
      />
    </div>
  );
}
