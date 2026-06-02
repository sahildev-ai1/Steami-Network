import * as React from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
import { EditorButton } from "./EditorButton";
import { ToolbarGroup } from "./ToolbarGroup";

interface RichTextToolbarProps {
  onCommand: (command: string, value?: string) => void;
  activeStates: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    code: boolean;
    h1: boolean;
    h2: boolean;
    h3: boolean;
    blockquote: boolean;
    ul: boolean;
    ol: boolean;
    justifyLeft: boolean;
    justifyCenter: boolean;
    justifyRight: boolean;
  };
  onInsertLink: () => void;
  onInsertImage: () => void;
  onInsertVideo: () => void;
}

export function RichTextToolbar({
  onCommand,
  activeStates,
  onInsertLink,
  onInsertImage,
  onInsertVideo,
}: RichTextToolbarProps) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-y-1 bg-[#0b1426]/90 border border-white/10 p-1.5 rounded-t-lg backdrop-blur-md overflow-x-auto shadow-md">
      {/* Undo / Redo */}
      <ToolbarGroup>
        <EditorButton
          icon={<Undo className="h-4 w-4" />}
          tooltip="Undo (Ctrl+Z)"
          onClick={() => onCommand("undo")}
        />
        <EditorButton
          icon={<Redo className="h-4 w-4" />}
          tooltip="Redo (Ctrl+Y)"
          onClick={() => onCommand("redo")}
        />
      </ToolbarGroup>

      {/* Typography Formats */}
      <ToolbarGroup>
        <EditorButton
          icon={<Bold className="h-4 w-4" />}
          tooltip="Bold (Ctrl+B)"
          active={activeStates.bold}
          onClick={() => onCommand("bold")}
        />
        <EditorButton
          icon={<Italic className="h-4 w-4" />}
          tooltip="Italic (Ctrl+I)"
          active={activeStates.italic}
          onClick={() => onCommand("italic")}
        />
        <EditorButton
          icon={<Underline className="h-4 w-4" />}
          tooltip="Underline (Ctrl+U)"
          active={activeStates.underline}
          onClick={() => onCommand("underline")}
        />
        <EditorButton
          icon={<Strikethrough className="h-4 w-4" />}
          tooltip="Strikethrough"
          active={activeStates.strikethrough}
          onClick={() => onCommand("strikeThrough")}
        />
        <EditorButton
          icon={<Code className="h-4 w-4" />}
          tooltip="Inline Code"
          active={activeStates.code}
          onClick={() => onCommand("formatBlock", "code")}
        />
      </ToolbarGroup>

      {/* Headings */}
      <ToolbarGroup>
        <EditorButton
          icon={<Heading1 className="h-4 w-4" />}
          tooltip="Heading 1"
          active={activeStates.h1}
          onClick={() => onCommand("formatBlock", "h1")}
        />
        <EditorButton
          icon={<Heading2 className="h-4 w-4" />}
          tooltip="Heading 2"
          active={activeStates.h2}
          onClick={() => onCommand("formatBlock", "h2")}
        />
        <EditorButton
          icon={<Heading3 className="h-4 w-4" />}
          tooltip="Heading 3"
          active={activeStates.h3}
          onClick={() => onCommand("formatBlock", "h3")}
        />
      </ToolbarGroup>

      {/* Block Structure */}
      <ToolbarGroup>
        <EditorButton
          icon={<Quote className="h-4 w-4" />}
          tooltip="Blockquote"
          active={activeStates.blockquote}
          onClick={() => onCommand("formatBlock", "blockquote")}
        />
        <EditorButton
          icon={<List className="h-4 w-4" />}
          tooltip="Bulleted List"
          active={activeStates.ul}
          onClick={() => onCommand("insertUnorderedList")}
        />
        <EditorButton
          icon={<ListOrdered className="h-4 w-4" />}
          tooltip="Numbered List"
          active={activeStates.ol}
          onClick={() => onCommand("insertOrderedList")}
        />
        <EditorButton
          icon={<Minus className="h-4 w-4" />}
          tooltip="Horizontal Line"
          onClick={() => onCommand("insertHorizontalRule")}
        />
      </ToolbarGroup>

      {/* Alignments */}
      <ToolbarGroup>
        <EditorButton
          icon={<AlignLeft className="h-4 w-4" />}
          tooltip="Align Left"
          active={activeStates.justifyLeft}
          onClick={() => onCommand("justifyLeft")}
        />
        <EditorButton
          icon={<AlignCenter className="h-4 w-4" />}
          tooltip="Align Center"
          active={activeStates.justifyCenter}
          onClick={() => onCommand("justifyCenter")}
        />
        <EditorButton
          icon={<AlignRight className="h-4 w-4" />}
          tooltip="Align Right"
          active={activeStates.justifyRight}
          onClick={() => onCommand("justifyRight")}
        />
      </ToolbarGroup>

      {/* Embeds and Media */}
      <ToolbarGroup>
        <EditorButton
          icon={<LinkIcon className="h-4 w-4" />}
          tooltip="Hyperlink (Ctrl+K)"
          onClick={onInsertLink}
        />
        <EditorButton
          icon={<ImageIcon className="h-4 w-4" />}
          tooltip="Insert Image"
          onClick={onInsertImage}
        />
        <EditorButton
          icon={<VideoIcon className="h-4 w-4" />}
          tooltip="Embed Video / YouTube"
          onClick={onInsertVideo}
        />
      </ToolbarGroup>
    </div>
  );
}
