import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSearchQuery, setActiveTopicId } from '../store/topicsSlice.js';
import { logout } from '../store/authSlice.js';
import { useTheme } from '../hooks/useTheme.js';
import TopicTree from './TopicTree.jsx';

export default function Sidebar() {
  const dispatch = useDispatch();
  const searchQuery = useSelector((state) => state.topics.searchQuery);
  const email = useSelector((state) => state.auth.email);
  const { dark, toggle } = useTheme();
  const [addMode, setAddMode] = useState(null);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(setActiveTopicId(null));
  };

  const toggleMode = (mode) => setAddMode((prev) => (prev === mode ? null : mode));

  return (
    <aside className="w-72 shrink-0 flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notebook</h1>
          <div className="flex items-center gap-0.5">

            {/* New File */}
            <button type="button" onClick={() => toggleMode('file')} title="New Topic"
              className={`p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400
                ${addMode === 'file'
                  ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0113.5 18h-9A1.5 1.5 0 013 16.5v-13z" />
              </svg>
            </button>

            {/* New Folder */}
            <button type="button" onClick={() => toggleMode('folder')} title="New Category"
              className={`p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400
                ${addMode === 'folder'
                  ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
              </svg>
            </button>

            {/* Theme toggle */}
            <button type="button" onClick={toggle}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400">
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

            {/* Logout */}
            <button type="button" onClick={handleLogout} title={`Sign out (${email})`}
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
            className="w-full pl-8 pr-3 py-2 text-sm
                       border border-gray-200 dark:border-gray-700
                       bg-gray-50 dark:bg-gray-800/60
                       text-gray-900 dark:text-gray-100
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       placeholder:text-gray-400 dark:placeholder:text-gray-500"
            aria-label="Search topics" />
        </div>
      </div>
      <TopicTree addMode={addMode} onAddDone={() => setAddMode(null)} />
    </aside>
  );
}
