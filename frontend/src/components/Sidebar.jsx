import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSearchQuery, setActiveTopicId } from '../store/topicsSlice.js';
import { logout } from '../store/authSlice.js';
import {
  useGetTopicsQuery,
  useCreateTopicMutation,
  useDeleteTopicMutation,
  useRetryResearchMutation,
} from '../services/api.js';
import { useTheme } from '../hooks/useTheme.js';
import StatusBadge from './shared/StatusBadge.jsx';

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

function TopicList() {
  const dispatch = useDispatch();
  const searchQuery = useSelector((state) => state.topics.searchQuery);
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);
  const { data: topics = [], isLoading, isError } = useGetTopicsQuery();
  const [deleteTopic] = useDeleteTopicMutation();
  const [retryResearch] = useRetryResearchMutation();

  const filtered = topics.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (e, topic) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${topic.name}"? This will remove all associated research and notes.`)) return;
    try {
      await deleteTopic(topic.id).unwrap();
      if (activeTopicId === topic.id) dispatch(setActiveTopicId(null));
    } catch {}
  };

  const handleRetry = async (e, topic) => {
    e.stopPropagation();
    dispatch(setActiveTopicId(topic.id));
    try { await retryResearch(topic.id).unwrap(); } catch {}
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">Loading topics…</div>;
  if (isError) return <div className="flex-1 flex items-center justify-center text-sm text-red-400 px-4 text-center">Failed to load topics.</div>;
  if (filtered.length === 0) return (
    <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 px-4 text-center">
      {searchQuery ? 'No matching topics.' : 'No topics yet. Add one below!'}
    </div>
  );

  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
      {filtered.map((topic) => {
        const isActive = topic.id === activeTopicId;
        return (
          <li
            key={topic.id}
            role="button"
            tabIndex={0}
            onClick={() => dispatch(setActiveTopicId(topic.id))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') dispatch(setActiveTopicId(topic.id)); }}
            className={`flex items-center gap-2 px-3 py-3 cursor-pointer transition-colors
              hover:bg-gray-50 dark:hover:bg-gray-800/60
              ${isActive
                ? 'bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/20 dark:border-blue-400'
                : 'border-l-4 border-transparent'
              }`}
          >
            <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {topic.name}
            </span>
            <StatusBadge status={topic.status} />
            {topic.status === 'researching' && (
              <button type="button" onClick={(e) => handleRetry(e, topic)}
                className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label={`Retry research for "${topic.name}"`} title="Retry research">
                <RetryIcon />
              </button>
            )}
            <button type="button" onClick={(e) => handleDelete(e, topic)}
              className="shrink-0 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label={`Delete topic "${topic.name}"`}>
              <TrashIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AddTopicInput() {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [createTopic, { isLoading }] = useCreateTopicMutation();
  const trimmed = name.trim();
  const isDisabled = trimmed.length === 0 || isLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDisabled) return;
    try {
      const result = await createTopic(trimmed).unwrap();
      dispatch(setActiveTopicId(result.id));
      setName('');
    } catch {}
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a topic…"
          disabled={isLoading}
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <button type="submit" disabled={isDisabled}
          className="shrink-0 px-3 py-2 text-sm font-medium text-white bg-blue-600
                     rounded-lg hover:bg-blue-700 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400">
          {isLoading ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Adding…
            </span>
          ) : 'Add'}
        </button>
      </div>
    </form>
  );
}

export default function Sidebar() {
  const dispatch = useDispatch();
  const searchQuery = useSelector((state) => state.topics.searchQuery);
  const email = useSelector((state) => state.auth.email);
  const { dark, toggle } = useTheme();

  const handleLogout = () => {
    dispatch(logout());
    dispatch(setActiveTopicId(null));
  };

  return (
    <aside className="w-72 shrink-0 flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Notebook
          </h1>
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggle}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400">
              {dark ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <button type="button" onClick={handleLogout}
              title={`Sign out (${email})`}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.007a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114L8.704 10.75H18.25A.75.75 0 0019 10z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        {email && <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 truncate">{email}</p>}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input type="search" value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            placeholder="Search topics…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                       placeholder:text-gray-400 dark:placeholder:text-gray-500"
            aria-label="Search topics" />
        </div>
      </div>
      <TopicList />
      <AddTopicInput />
    </aside>
  );
}
