import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setActiveTopicId } from '../store/topicsSlice.js';
import { useDeleteTopicMutation, useRetryResearchMutation, useRenameTopicMutation } from '../services/api.js';
import StatusBadge from './shared/StatusBadge.jsx';
import ConfirmDialog from './shared/ConfirmDialog.jsx';

function FileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true">
      <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0113.5 18h-9A1.5 1.5 0 013 16.5v-13z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
    </svg>
  );
}

export default function FileRow({ topic, isActive, activeTopicId }) {
  const dispatch = useDispatch();
  const [deleteTopic] = useDeleteTopicMutation();
  const [retryResearch] = useRetryResearchMutation();
  const [renameTopic] = useRenameTopicMutation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const renameRef = useRef(null);

  useEffect(() => {
    if (isRenaming) renameRef.current?.focus();
  }, [isRenaming]);

  const startRename = (e) => {
    e.stopPropagation();
    setRenameValue(topic.name);
    setIsRenaming(true);
  };

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== topic.name) {
      try { await renameTopic({ id: topic.id, name: trimmed }).unwrap(); } catch {}
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setIsRenaming(false);
  };

  const handleClick = () => {
    if (isRenaming) return;
    dispatch(setActiveTopicId(topic.id));
  };

  const handleKeyDown = (e) => {
    if (isRenaming) return;
    if (e.key === 'Enter' || e.key === ' ') dispatch(setActiveTopicId(topic.id));
  };

  const handleDeleteConfirmed = async () => {
    setConfirmOpen(false);
    try {
      await deleteTopic(topic.id).unwrap();
      if (activeTopicId === topic.id) dispatch(setActiveTopicId(null));
    } catch {}
  };

  const handleRetry = async (e) => {
    e.stopPropagation();
    dispatch(setActiveTopicId(topic.id));
    try { await retryResearch(topic.id).unwrap(); } catch {}
  };

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${topic.name}"?`}
        message="This will permanently remove the topic, its research, and all saved notes."
        confirmLabel="Delete topic"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />

      <li
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`flex items-center gap-2 px-3 py-3 cursor-pointer transition-colors
          hover:bg-gray-100 dark:hover:bg-gray-800/60
          ${isActive
            ? 'bg-brand-50 border-l-4 border-brand-500 dark:bg-brand-900/20 dark:border-brand-400'
            : 'border-l-4 border-transparent'
          }`}
      >
        <FileIcon />

        {isRenaming ? (
          <input
            ref={renameRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1 py-0 text-sm font-medium bg-transparent
                       border border-brand-400 dark:border-brand-500 rounded
                       text-gray-800 dark:text-gray-200
                       focus:outline-none focus:ring-1 focus:ring-brand-400 dark:focus:ring-brand-500"
          />
        ) : (
          <span
            onDoubleClick={startRename}
            className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-200 truncate select-none"
            title="Double-click to rename"
          >
            {topic.name}
          </span>
        )}

        <StatusBadge status={topic.status} />
        {topic.status === 'researching' && (
          <button type="button" onClick={handleRetry}
            className="shrink-0 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300
                       transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label={`Retry research for "${topic.name}"`} title="Retry research">
            <RetryIcon />
          </button>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          className="shrink-0 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400
                     transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label={`Delete topic "${topic.name}"`}>
          <TrashIcon />
        </button>
      </li>
    </>
  );
}
