import { useMemo, useRef, useState ,useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { expandFolder, setActiveTopicId } from '../store/topicsSlice.js';
import { useGetTopicTreeQuery, useCreateTopicMutation, useCreateMainTopicMutation } from '../services/api.js';
import FolderRow from './FolderRow.jsx';
import FileRow from './FileRow.jsx';

// Inline input shown at top of tree when addMode is active
function InlineAddInput({ mode, onDone }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const [createTopic, { isLoading: fileLoading }] = useCreateTopicMutation();
  const [createMainTopic, { isLoading: folderLoading }] = useCreateMainTopicMutation();
  const isLoading = fileLoading || folderLoading;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const placeholder = mode === 'folder' ? 'Category name…' : 'Topic name…';
  const icon = mode === 'folder'
    ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-amber-400">
        <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
      </svg>
    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-gray-400">
        <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0113.5 18h-9A1.5 1.5 0 013 16.5v-13z" />
      </svg>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Name cannot be empty.'); return; }
    setError('');
    try {
      if (mode === 'folder') {
        const result = await createMainTopic({ name: trimmed }).unwrap();
        dispatch(expandFolder(result.id));
      } else {
        const result = await createTopic({ name: trimmed }).unwrap();
        dispatch(setActiveTopicId(result.id));
      }
      onDone();
    } catch {
      setError('Failed to create. Try again.');
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Escape') onDone(); };

  return (
    <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        {icon}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border border-brand-400 rounded
                     text-gray-900 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-brand-400
                     disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <button type="button" onClick={onDone} disabled={isLoading}
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-1 focus:outline-none"
          aria-label="Cancel">✕</button>
      </form>
      {error && <p className="mt-0.5 pl-6 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function TopicTree({ addMode, onAddDone }) {
  const expandedFolderIds = useSelector((state) => state.topics.expandedFolderIds);
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);
  const searchQuery = useSelector((state) => state.topics.searchQuery);

  const [pollInterval, setPollInterval] = useState(0);

  const { data, isLoading, isError } = useGetTopicTreeQuery(undefined, {
    pollingInterval: pollInterval,
  });

  const mainTopics = data?.main_topics ?? [];
  const rootTopics = data?.root_topics ?? [];

  // Poll only while something is researching — background job updates status server-side
  const hasResearching = useMemo(() =>
    mainTopics.some((f) => (f.sub_topics ?? []).some((s) => s.status === 'researching')) ||
    rootTopics.some((t) => t.status === 'researching'),
  [mainTopics, rootTopics]);

  useEffect(() => {
    setPollInterval(hasResearching ? 3000 : 0);
  }, [hasResearching]);

  // O(1) folder expansion lookup
  const expandedSet = useMemo(() => new Set(expandedFolderIds), [expandedFolderIds]);

  // Filtered lists — only recalculate when data or query changes
  const { filteredMainTopics, filteredRootTopics } = useMemo(() => {
    const lq = searchQuery.toLowerCase();
    return {
      filteredMainTopics: searchQuery
        ? mainTopics
            .map((folder) => ({
              ...folder,
              sub_topics: (folder.sub_topics ?? []).filter((s) =>
                s.name.toLowerCase().includes(lq)
              ),
            }))
            .filter((f) => f.name.toLowerCase().includes(lq) || f.sub_topics.length > 0)
        : mainTopics,
      filteredRootTopics: rootTopics.filter((t) =>
        t.name.toLowerCase().includes(lq)
      ),
    };
  }, [mainTopics, rootTopics, searchQuery]);

  // ALL hooks above this line — early returns only below
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        Loading topics…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-red-400 px-4 text-center">
        Failed to load topics.
      </div>
    );
  }

  const isEmpty = filteredMainTopics.length === 0 && filteredRootTopics.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {addMode && <InlineAddInput mode={addMode} onDone={onAddDone} />}

      {isEmpty && !addMode ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 px-4 text-center">
          {searchQuery ? 'No matching topics.' : 'No topics yet. Use the icons above to add one.'}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {filteredMainTopics.map((folder) => (
            <FolderRow key={folder.id} folder={folder} isExpanded={expandedSet.has(folder.id)} />
          ))}
          {filteredRootTopics.map((topic) => (
            <FileRow key={topic.id} topic={topic} isActive={topic.id === activeTopicId} activeTopicId={activeTopicId} />
          ))}
        </ul>
      )}
    </div>
  );
}
