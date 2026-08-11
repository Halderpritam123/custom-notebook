import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from './hooks/useTheme.js';
import { useTopicQueryParam } from './hooks/useTopicQueryParam.js';
import Sidebar from './components/Sidebar.jsx';
import TopicPanel from './components/TopicPanel.jsx';
import AuthPage from './components/AuthPage.jsx';
import AuthCallback from './components/AuthCallback.jsx';

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 288;

function App() {
  useTheme();
  useTopicQueryParam();
  const token = useSelector((state) => state.auth.token);
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dragging = useRef(false);

  // Close mobile drawer when a topic is selected
  useEffect(() => {
    if (activeTopicId) setMobileOpen(false);
  }, [activeTopicId]);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (e) => {
      if (!dragging.current) return;
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  if (window.location.pathname === '/auth/callback') return <AuthCallback />;
  if (!token) return <AuthPage />;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Desktop sidebar + drag handle ── */}
      <div className="hidden md:flex shrink-0">
        <Sidebar width={sidebarWidth} />
        <div
          onMouseDown={onMouseDown}
          className="w-1 cursor-col-resize bg-transparent hover:bg-brand-400 dark:hover:bg-brand-500 transition-colors relative"
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* ── Mobile drawer panel ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 ease-in-out md:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Sidebar width={288} onClose={() => setMobileOpen(false)} isMobile />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
            aria-label="Open sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notebook</span>
        </div>

        <TopicPanel />
      </div>
    </div>
  );
}

export default App;
