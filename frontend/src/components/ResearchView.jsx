import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUpdateResearchMutation } from '../services/api.js';

const FIELDS = [
  { key: 'summary',                label: 'Summary' },
  { key: 'key_concepts',           label: 'Key Concepts' },
  { key: 'background_context',     label: 'Background & Context' },
  { key: 'how_it_works',           label: 'How It Works' },
  { key: 'real_world_applications',label: 'Real-World Applications' },
  { key: 'common_misconceptions',  label: 'Common Misconceptions' },
  { key: 'related_topics',         label: 'Related Topics' },
  { key: 'open_questions',         label: 'Open Questions' },
];

const markdownComponents = {
  p:      ({ children }) => <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
  ul:     ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">{children}</ul>,
  ol:     ({ children }) => <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">{children}</ol>,
  li:     ({ children }) => <li className="text-sm text-gray-700 dark:text-gray-300">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-800 dark:text-gray-200">{children}</strong>,
  em:     ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
  code:   ({ children }) => <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-800 dark:text-gray-200">{children}</code>,
};

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

function BookmarkFilledIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
    </svg>
  );
}

function FieldSection({ topicId, fieldKey, label, content, onSaved }) {
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState('');
  const [collapsing, setCollapsing] = useState(false);
  const [updateResearch, { isLoading: isSaving }] = useUpdateResearchMutation();

  if (!content && !editing) return null;

  const startEdit = () => { setDraft(content ?? ''); setEditing(true); };
  const cancel    = () => setEditing(false);

  const save = async () => {
    try {
      const result = await updateResearch({ topicId, [fieldKey]: draft.trim() }).unwrap();
      onSaved(result);
      setEditing(false);
    } catch {}
  };

  const handleDelete = async () => {
    setCollapsing(true);
    try {
      const result = await updateResearch({ topicId, [fieldKey]: '' }).unwrap();
      // small delay so the collapse animation plays before content disappears
      setTimeout(() => onSaved(result), 300);
    } catch {
      setCollapsing(false);
    }
  };

  return (
    <section
      className={`group relative overflow-hidden transition-all duration-300 ease-in-out
        ${collapsing ? 'max-h-0 opacity-0 mb-0' : 'max-h-[2000px] opacity-100'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {label}
        </h3>
        {!editing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={startEdit}
              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-brand-400"
              title="Edit"
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={collapsing}
              className="p-1 rounded text-brand-500 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-brand-400"
              title="Remove section"
            >
              <BookmarkFilledIcon />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900
                       text-sm text-gray-800 dark:text-gray-200 px-3 py-2 resize-y
                       focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="px-3 py-1 text-xs font-medium text-white bg-brand-500 rounded-md
                         hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400
                         bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="prose-sm max-w-none">
          <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}

export default function ResearchView({ topicId, research, onResearchUpdated }) {
  if (!research) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Research</h2>
      <div className="space-y-5">
        {FIELDS.map(({ key, label }) => (
          <FieldSection
            key={key}
            topicId={topicId}
            fieldKey={key}
            label={label}
            content={research[key]}
            onSaved={onResearchUpdated}
          />
        ))}
      </div>
    </div>
  );
}
