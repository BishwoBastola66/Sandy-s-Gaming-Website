'use client';

import React from 'react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Table,
} from 'lucide-react';

interface EditorToolbarProps {
  onInsertFormatting: (prefix: string, suffix?: string, defaultText?: string) => void;
  onInsertImageFile: (file: File) => void;
  docImageInputRef: React.RefObject<HTMLInputElement | null>;
}

export function EditorToolbar({
  onInsertFormatting,
  onInsertImageFile,
  docImageInputRef,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#16161d] p-1.5 border border-white/[0.08]">
      <input
        ref={docImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onInsertImageFile(file);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => onInsertFormatting('# ', '', 'Major Heading')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Heading 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsertFormatting('## ', '', 'Section Heading')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsertFormatting('### ', '', 'Subsection Heading')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>

      <span className="w-px h-3.5 bg-white/[0.1] mx-0.5" />

      <button
        type="button"
        onClick={() => onInsertFormatting('**', '**', 'bold text')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsertFormatting('*', '*', 'italic text')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsertFormatting('~~', '~~', 'strikethrough')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>

      <span className="w-px h-3.5 bg-white/[0.1] mx-0.5" />

      <button
        type="button"
        onClick={() => onInsertFormatting('> ', '', 'Pro Tip or Quote')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Quote block"
      >
        <Quote className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsertFormatting('- ', '', 'Bullet item')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsertFormatting('1. ', '', 'Numbered item')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>

      <span className="w-px h-3.5 bg-white/[0.1] mx-0.5" />

      <button
        type="button"
        onClick={() => onInsertFormatting('```\n', '\n```', 'code or stats block')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Code block"
      >
        <Code className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsertFormatting('\n\n---\n\n', '', '')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Divider line"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() =>
          onInsertFormatting(
            '\n\n| Item / Boss | Multiplier | Recommended Setup |\n| :--- | :--- | :--- |\n| Golden Dragon | 100x - 300x | High Multiplier Cannons |\n| Demon King | 50x - 120x | Co-Op Focus Fire |\n\n',
            '',
            ''
          )
        }
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Insert Table"
      >
        <Table className="h-3.5 w-3.5" />
      </button>

      <span className="w-px h-3.5 bg-white/[0.1] mx-0.5" />

      <button
        type="button"
        onClick={() => onInsertFormatting('[Link text](', ')', 'https://')}
        className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-300 cursor-pointer"
        title="Insert Link"
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => docImageInputRef.current?.click()}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#e8364b]/15 text-[#ff6b7d] border border-[#e8364b]/30 hover:bg-[#e8364b]/25 transition-colors cursor-pointer text-xs font-semibold"
        title="Upload & Insert Image"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        <span>Insert Image</span>
      </button>

      <span className="ml-auto text-[10px] text-neutral-400 hidden sm:inline">
        Tip: Drag &amp; drop images directly into document
      </span>
    </div>
  );
}

