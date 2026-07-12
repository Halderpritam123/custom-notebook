import React from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from './hooks/useTheme.js';
import { useTopicQueryParam } from './hooks/useTopicQueryParam.js';
import Sidebar from './components/Sidebar.jsx';
import TopicPanel from './components/TopicPanel.jsx';
import AuthPage from './components/AuthPage.jsx';
import AuthCallback from './components/AuthCallback.jsx';

function App() {
  useTheme();
  useTopicQueryParam();
  const token = useSelector((state) => state.auth.token);

  // Handle OAuth redirect callback
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (!token) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar />
      <TopicPanel />
    </div>
  );
}

export default App;
