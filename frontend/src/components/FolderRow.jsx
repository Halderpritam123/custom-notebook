import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleFolder, expandFolder, setActiveTopicId } from '../store/topicsSlice.js';
import { useDeleteMainTopicMutation, useRenameMainTopicMutation, useCreateMainTopicMutation, useCreateTopicMutation } from '../services/api.js';
import FileRow from './FileRow.jsx';
import ConfirmDialog from './shared/ConfirmDialog.jsx';

function ChevronIcon({ expanded }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className={`w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      aria-hidden="true">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className="w-4 h-4 shrink-0 text-amber-400 dark:text-amber-500" aria-hidden="true">
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

// Inline input for adding a subcategory or topic directly inside a folder
function InlineFolderInput({ parentId, mode, onClose }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const [createFolder, { isLoading: folderLoading }] = useCreateMainTopicMutation();
  const [createTopic, { isLoading: topicLoading }] = useCreateTopicMutation();
  const isLoading = folderLoading || topicLoading;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Name cannot be empty.'); return; }
    setError('');
    try {
      if (mode === 'folder') {
        const result = await createFolder({ name: trimmed, parent_id: parentId }).unwrap();
        dispatch(expandFolder(result.id));
      } else {
        const result = await createTopic({ name: trimmed, parent_id: parentId }).unwrap();
        dispatch(expandFolder(parentId));
        dispatch(setActiveTopicId(result.id));
      }
      onClose();
    } catch {
      setError('Failed to create. Try again.');
    }
  };

  return (
    <div className="pl-6 pr-2 py-1 bg-gray-50 dark:bg-gray-800/40">
      <div className="flex gap-1 mb-1 text-xs">
        <button type="button" onClick={() => {}} className="text-gray-400 text-xs">
          {mode === 'folder' ? '📁 Subcategory' : '📄 Topic'}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          placeholder={mode === 'folder' ? 'Subcategory name…' : 'Topic name…'}
          disabled={isLoading}
          className="flex-1 min-w-0 px-2 py-1 text-sm bg-white dark:bg-gray-900 border border-brand-400 rounded
                     text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-400
                     disabled:opacity-50 placeholder:text-gray-400"
        />
        <button type="button" onClick={onClose} disabled={isLoading}
          className="shrink-0 text-gray-400 hover:text-gray-600 text-xs px-1 focus:outline-none">✕</button>
      </form>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// FolderRow is recursive — renders subcategories and topics at any depth
export default function FolderRow({ folder, depth = 0 }) {
  const dispatch = useDispatch();
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);
  const expandedFolderIds = useSelector((state) => state.topics.expandedFolderIds);
  const expandedSet = useMemo(() => new Set(expandedFolderIds), [expandedFolderIds]);
  const isExpanded = expandedSet.has(folder.id);

  const [addMode, setAddMode] = useState(null); // null | 'folder' | 'topic'
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

  const handleAddClick = (e, mode) => {
    e.stopPropagation();
    setAddMode((prev) => (prev === mode ? null : mode));
    if (!isExpanded) dispatch(expandFolder(folder.id));
  };

  const handleDeleteConfirmed = async () => {
    setConfirmOpen(false);
    try { await deleteMainTopic(folder.id).unwrap(); } catch {}
  };

  const children = folder.children ?? [];
  const indent = depth * 12; // px indent per level

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${folder.name}"?`}
        message="This will permanently delete the folder and everything inside it."
        confirmLabel="Delete folder"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />

      <li>
        <div
          role="button"
          tabIndex={0}
          onClick={handleRowClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') dispatch(toggleFolder(folder.id)); }}
          style={{ paddingLeft: `${12 + indent}px` }}
          className="flex items-center gap-1.5 pr-3 py-2.5 cursor-pointer transition-colors
            border-l-4 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/60"
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
                         focus:outline-none focus:ring-1 focus:ring-brand-400"
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

          {/* Add topic */}
          <button type="button" onClick={(e) => handleAddClick(e, 'topic')}
            className="shrink-0 text-gray-400 hover:text-brand-500 dark:text-gray-500 dark:hover:text-brand-400
                       transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-brand-400"
            aria-label={`Add topic to "${folder.name}"`} title="Add topic">
            <PlusIcon />
          </button>
          {/* Add subcategory */}
          <button type="button" onClick={(e) => handleAddClick(e, 'folder')}
            className="shrink-0 text-amber-400 hover:text-amber-500 dark:text-amber-500 dark:hover:text-amber-400
                       transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label={`Add subcategory to "${folder.name}"`} title="Add subcategory">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
            </svg>
          </button>
          {/* Delete folder */}
          <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="shrink-0 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400
                       transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label={`Delete "${folder.name}"`} title="Delete folder">
            <TrashIcon />
          </button>
        </div>

        {isExpanded && (
          <div>
            {addMode && (
              <InlineFolderInput
                parentId={folder.id}
                mode={addMode}
                onClose={() => setAddMode(null)}
              />
            )}
            {children.length > 0 ? (
              <ul>
                {children.map((child) =>
                  child.is_folder
                    ? <FolderRow key={child.id} folder={child} depth={depth + 1} />
                    : <FileRow key={child.id} topic={child} isActive={child.id === activeTopicId} activeTopicId={activeTopicId} indent={indent + 24} />
                )}
              </ul>
            ) : !addMode ? (
              <p style={{ paddingLeft: `${28 + indent}px` }} className="pb-2 text-xs text-gray-400 dark:text-gray-500">
                Empty folder.
              </p>
            ) : null}
          </div>
        )}
      </li>
    </>
  );
}
