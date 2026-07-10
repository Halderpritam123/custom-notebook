import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import RichEditor from './RichEditor.jsx';
import { useSaveNoteMutation, useDeleteNoteMutation, useUpdateNoteMutation } from '../services/api.js';
import { addMessage, markSaved, markUnsaved } from '../store/chatSlice.js';

/** Convert markdown to simple HTML for TipTap initial content */
function mdToHtml(md) {
  if (!md) return '';
  // Check if content is already HTML
  if (md.trim().startsWith('<')) return md;
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .trim();
}

function BookmarkOutlineIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
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

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

function AssistantMessage({ topicId, content: initialContent, savedNoteId: initialNoteId }) {
  const [savedNoteId, setSavedNoteId] = useState(initialNoteId ?? null);
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const dispatch = useDispatch();
  const [saveNote, { isLoading: isSaving }] = useSaveNoteMutation();
  const [deleteNote, { isLoading: isDeleting }] = useDeleteNoteMutation();
  const [updateNote, { isLoading: isUpdating }] = useUpdateNoteMutation();
  const isBusy = isSaving || isDeleting || isUpdating;
  const isSaved = savedNoteId !== null;
  const isFromDb = initialNoteId != null || isSaved;

  const startEditing = () => {
    setEditHtml(mdToHtml(content));
    setIsEditing(true);
  };

  const handleBookmarkClick = async () => {
    if (isBusy) return;
    if (!isSaved) {
      try {
        const r = await saveNote({ topicId, content }).unwrap();
        setSavedNoteId(r.id);
        dispatch(markSaved({ topicId, content, noteId: r.id }));
      } catch {}
    } else {
      try {
        await deleteNote({ topicId, noteId: savedNoteId }).unwrap();
        dispatch(markUnsaved({ topicId, noteId: savedNoteId }));
        setSavedNoteId(null);
      } catch {}
    }
  };

  const handleEditSave = async () => {
    const trimmed = editHtml.trim();
    if (!trimmed || trimmed === content) { setIsEditing(false); return; }
    if (isSaved && savedNoteId) {
      try {
        await updateNote({ topicId, noteId: savedNoteId, content: trimmed }).unwrap();
        setContent(trimmed);
      } catch {}
    } else {
      try {
        const r = await saveNote({ topicId, content: trimmed }).unwrap();
        setSavedNoteId(r.id);
        dispatch(markSaved({ topicId, content: trimmed, noteId: r.id }));
        setContent(trimmed);
      } catch {}
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') { setIsEditing(false); }
  };

  // DB-seeded messages: full width, edit + bookmark overlaid on hover
  if (isFromDb) {
    return (
      <div className="relative w-full group">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <RichEditor initialContent={editHtml} onChange={setEditHtml} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600
                           text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
                           transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400">
                Cancel
              </button>
              <button type="button" onClick={handleEditSave} disabled={isBusy}
                className="px-3 py-1.5 text-xs rounded-lg bg-brand-500 text-white
                           hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                           focus:outline-none focus:ring-2 focus:ring-brand-400">
                {isBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl px-4 py-2.5 pr-16 text-sm leading-relaxed w-full">
            {content.trim().startsWith('<')
              ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
              : <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">{content}</ReactMarkdown>
            }
          </div>
        )}
        {!isEditing && (
          <div className="absolute top-2 right-2 flex gap-1">
            {isSaved && (
              <button type="button" onClick={startEditing} disabled={isBusy} title="Edit note" aria-label="Edit note"
                className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
                           opacity-0 group-hover:opacity-100 transition-opacity
                           disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-400">
                <PencilIcon />
              </button>
            )}
            <button type="button" onClick={handleBookmarkClick} disabled={isBusy}
              title={isSaved ? 'Remove saved note' : 'Save as note'}
              aria-label={isSaved ? 'Remove saved note' : 'Save as note'}
              className={`p-1 rounded transition-colors
                ${isSaved ? 'text-brand-500 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}
                disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-400`}>
              {isSaved ? <BookmarkFilledIcon /> : <BookmarkOutlineIcon />}
            </button>
          </div>
        )}
      </div>
    );
  }

  // New session messages: in-place editable bubble with pencil + bookmark
  return (
    <div className="flex items-start gap-2 max-w-[85%]">
      <div className="relative group flex-1">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <RichEditor initialContent={editHtml} onChange={setEditHtml} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600
                           text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
                           transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400">
                Cancel
              </button>
              <button type="button" onClick={handleEditSave} disabled={isBusy}
                className="px-3 py-1.5 text-xs rounded-lg bg-brand-500 text-white
                           hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                           focus:outline-none focus:ring-2 focus:ring-brand-400">
                {isBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
            {content.trim().startsWith('<')
              ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
              : <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">{content}</ReactMarkdown>
            }
          </div>
        )}
        {!isEditing && (
          <button type="button" onClick={startEditing} title="Edit" aria-label="Edit response"
            className="absolute top-2 right-2 p-1 rounded text-gray-400 dark:text-gray-500
                       hover:text-gray-600 dark:hover:text-gray-300
                       opacity-0 group-hover:opacity-100 transition-opacity
                       focus:outline-none focus:ring-2 focus:ring-brand-400">
            <PencilIcon />
          </button>
        )}
      </div>
      {!isEditing && (
        <button type="button" onClick={handleBookmarkClick} disabled={isBusy}
          title={isSaved ? 'Remove saved note' : 'Save as note'}
          aria-label={isSaved ? 'Remove saved note' : 'Save as note'}
          className={`shrink-0 mt-1 p-1 rounded transition-colors
            ${isSaved ? 'text-brand-500 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}
            disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-400`}>
          {isSaved ? <BookmarkFilledIcon /> : <BookmarkOutlineIcon />}
        </button>
      )}
    </div>
  );
}

function UserMessage({ content }) {
  return (
    <div className="flex justify-end">
      <div className="bg-brand-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[85%]">
        {content}
      </div>
    </div>
  );
}

export default function ChatThread({ topicId, savedNotes }) {
  const dispatch = useDispatch();
  const session = useSelector((state) => state.chat.sessions[topicId]);

  useEffect(() => {
    if (session === undefined && savedNotes?.length) {
      savedNotes.forEach((n) => {
        dispatch(addMessage({ topicId, message: { role: 'assistant', content: n.content, noteId: n.id } }));
      });
    }
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const messages = session ?? [];
  if (messages.length === 0) return null;

  return (
    <section aria-label="Follow-up chat thread">
      <div className="flex flex-col gap-3">
        {messages.map((msg, idx) =>
          msg.role === 'user'
            ? <UserMessage key={`${topicId}-${idx}-u`} content={msg.content} />
            : <AssistantMessage
                key={`${topicId}-${idx}-a`}
                topicId={topicId}
                content={msg.content}
                savedNoteId={msg.noteId ?? null}
              />
        )}
      </div>
    </section>
  );
}
