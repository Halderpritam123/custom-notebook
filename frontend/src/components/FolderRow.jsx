import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleFolder } from '../store/topicsSlice.js';
import { useDeleteMainTopicMutation, useRenameMainTopicMutation } from '../services/api.js';
import FileRow from './FileRow.jsx';
import AddSubTopicInput from './AddSubTopicInput.jsx';
import ConfirmDialog from './shared/ConfirmDialog.jsx';

function ChevronIcon({ expanded }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-amber-400 dark:text-amber-500" aria-hidden="true">
      <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
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

export default function FolderRow({ folder, isExpanded }) {
  const dispatch = useDispatch();
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);
  const [showInput, setShowInput] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const renameRef = useRef(null);
  const [deleteMainTopic] = useDeleteMainTopicMutation();
  const [renameMainTopic] = useRenameMainTopicMutation();

  useEffect(() => {
    if (isRenaming) renameRef.current?.focus();
  }, [isRenaming]);

  const startRename = (e) => {
    e.stopPropagation();
    setRenameValue(folder.name);
    setIsRenaming(true);
  };

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      try { await renameMainTopic({ id: folder.id, name: trimmed }).unwrap(); } catch {}
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setIsRenaming(false);
  };

  const handleRowClick = () => {
    if (isRenaming) return;
    dispatch(toggleFolder(folder.id));
  };

  const handleKeyDown = (e) => {
    if (isRenaming) return;
    if (e.key === 'Enter' || e.key === ' ') dispatch(toggleFolder(folder.id));
  };

  const handleAddClick = (e) => {
    e.stopPropagation();
    setShowInput((prev) => !prev);
    if (!isExpanded) dispatch(toggleFolder(folder.id));
  };

  const handleDeleteConfirmed = async () => {
    setConfirmOpen(false);
    try { await deleteMainTopic(folder.id).unwrap(); } catch {}
  };

  const subTopics = folder.sub_topics ?? [];

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${folder.name}"?`}
        message="This will permanently delete the folder and all its sub-topics, research, and notes."
        confirmLabel="Delete folder"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />

      <li>
        <div
          role="button"
          tabIndex={0}
          onClick={handleRowClick}
          onKeyDown={handleKeyDown}
          className="flex items-center gap-1.5 px-3 py-2.5 cursor-pointer transition-colors
            border-l-4 border-transparent
            hover:bg-gray-100 dark:hover:bg-gray-800/60"
        >
          <ChevronIcon expanded={isExpanded} />
          <FolderIcon />

          {isRenaming ? (
            <input
              ref={renameRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 px-1 py-0 text-sm font-semibold bg-transparent
                         border border-brand-400 dark:border-brand-500 rounded
                         text-gray-700 dark:text-gray-300
                         focus:outline-none focus:ring-1 focus:ring-brand-400 dark:focus:ring-brand-500"
            />
          ) : (
            <span
              onDoubleClick={startRename}
              className="flex-1 min-w-0 text-sm font-semibold text-gray-700 dark:text-gray-300 truncate select-none"
              title="Double-click to rename"
            >
              {folder.name}
            </span>
          )}

          <button type="button" onClick={handleAddClick}
            className="shrink-0 text-gray-400 hover:text-brand-500 dark:text-gray-500 dark:hover:text-brand-400
                       transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-brand-400"
            aria-label={`Add sub-topic to "${folder.name}"`} title="Add sub-topic">
            <PlusIcon />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="shrink-0 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400
                       transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label={`Delete folder "${folder.name}"`} title="Delete folder">
            <TrashIcon />
          </button>
        </div>

        {isExpanded && (
          <div>
            {showInput && (
              <AddSubTopicInput parentId={folder.id} onClose={() => setShowInput(false)} />
            )}
            {subTopics.length > 0 ? (
              <ul className="pl-4">
                {subTopics.map((sub) => (
                  <FileRow key={sub.id} topic={sub} isActive={sub.id === activeTopicId} activeTopicId={activeTopicId} />
                ))}
              </ul>
            ) : !showInput ? (
              <p className="pl-8 pb-2 text-xs text-gray-400 dark:text-gray-500">No sub-topics yet.</p>
            ) : null}
          </div>
        )}
      </li>
    </>
  );
}
