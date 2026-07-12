import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

/**
 * Minimal WYSIWYG editor using TipTap.
 * Accepts initialContent as markdown-converted HTML or plain text.
 * Calls onChange(html) on every keystroke.
 */
export default function RichEditor({ initialContent, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  return (
    <div
      className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200
                 rounded-2xl px-4 py-2.5 text-sm leading-relaxed min-h-[200px]
                 focus-within:ring-2 focus-within:ring-brand-400 cursor-text
                 prose prose-sm dark:prose-invert max-w-none"
      onClick={() => editor?.chain().focus().run()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
