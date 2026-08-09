import React, { useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from './hooks/useTheme.js';
import { useTopicQueryParam } from './hooks/useTopicQueryParam.js';
import Sidebar from './components/Sidebar.jsx';
import TopicPanel from './components/TopicPanel.jsx';
import AuthPage from './components/AuthPage.jsx';
import AuthCallback from './components/AuthCallback.jsx';

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 288; // w-72 = 18rem = 288px

function App() {
  useTheme();
  useTopicQueryParam();
  const token = useSelector((state) => state.auth.token);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);

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

  // Handle OAuth redirect callback
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (!token) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar width={sidebarWidth} />

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-brand-400 dark:hover:bg-brand-500 transition-colors group relative"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
      >
        {/* Wider invisible hit area */}
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      <TopicPanel />
    </div>
  );
}

export default App;
