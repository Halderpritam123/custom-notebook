import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSaveNoteMutation, useDeleteNoteMutation } from '../services/api.js';

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

function AssistantMessage({ topicId, content }) {
  const [savedNoteId, setSavedNoteId] = useState(null);
  const [saveNote, { isLoading: isSaving }] = useSaveNoteMutation();
  const [deleteNote, { isLoading: isDeleting }] = useDeleteNoteMutation();
  const isBusy = isSaving || isDeleting;
  const isSaved = savedNoteId !== null;

  const handleBookmarkClick = async () => {
    if (isBusy) return;
    if (!isSaved) {
      try {
        const r = await saveNote({ topicId, content }).unwrap();
        setSavedNoteId(r.id);
      } catch {}
    } else {
      try {
        await deleteNote({ topicId, noteId: savedNoteId }).unwrap();
        setSavedNoteId(null);
      } catch {}
    }
  };

  return (
    <div className="flex items-start gap-2 max-w-[85%]">
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>
      <button
        type="button"
        onClick={handleBookmarkClick}
        disabled={isBusy}
        title={isSaved ? 'Remove saved note' : 'Save as note'}
        aria-label={isSaved ? 'Remove saved note' : 'Save as note'}
        className={`shrink-0 mt-1 p-1 rounded transition-colors
          ${isSaved
            ? 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }
          disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400`}
      >
        {isSaved ? <BookmarkFilledIcon /> : <BookmarkOutlineIcon />}
      </button>
    </div>
  );
}

function UserMessage({ content }) {
  return (
    <div className="flex justify-end">
      <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[85%]">
        {content}
      </div>
    </div>
  );
}

export default function ChatThread({ topicId }) {
  const messages = useSelector((state) => state.chat.sessions[topicId] ?? []);
  if (messages.length === 0) return null;
  return (
    <section aria-label="Follow-up chat thread">
      <div className="flex flex-col gap-3">
        {messages.map((msg, idx) =>
          msg.role === 'user'
            ? <UserMessage key={idx} content={msg.content} />
            : <AssistantMessage key={idx} topicId={topicId} content={msg.content} />
        )}
      </div>
    </section>
  );
}
