"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import sanitizeHtml from "sanitize-html";

export function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value);
  }, [editor, value]);
  return (
    <div className="rich-editor">
      <div className="editor-toolbar">
        <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}>Bullets</button>
        <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>Numbered list</button>
        <button type="button" disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Quote</button>
      </div>
      <EditorContent editor={editor} className="editor-content"/>
    </div>
  );
}

export function RichTextViewer({ value }: { value: string }) {
  const safe = sanitizeHtml(value, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "a", "code", "pre"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
  return <div className="rich-viewer" dangerouslySetInnerHTML={{ __html: safe }}/>;
}
