import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetTopicQuery, useUpdateTopicStatusMutation } from '../services/api.js';
import { apiSlice } from '../services/api.js';
import StatusBadge from './shared/StatusBadge.jsx';
import ResearchView from './ResearchView.jsx';
import ChatThread from './ChatThread.jsx';
import ChatInput from './ChatInput.jsx';

function PanelHeader({ topic }) {
  const [updateTopicStatus, { isLoading: isUpdating }] = useUpdateTopicStatusMutation();
  const handleMarkReviewed = async () => {
    try { await updateTopicStatus({ id: topic.id, status: 'reviewed' }).unwrap(); } catch {}
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{topic.name}</h2>
        <StatusBadge status={topic.status} />
      </div>
      {topic.status === 'reading' && (
        <button type="button" onClick={handleMarkReviewed} disabled={isUpdating}
          className="shrink-0 ml-4 px-4 py-2 text-sm font-medium text-white
                     bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-400">
          {isUpdating ? 'Saving…' : 'Mark as Reviewed'}
        </button>
      )}
    </div>
  );
}

function ResearchingState({ topicName }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500 dark:text-gray-400">
      <svg className="animate-spin w-8 h-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <div className="text-center">
        <p className="text-base font-medium text-gray-700 dark:text-gray-300">Researching &ldquo;{topicName}&rdquo;&hellip;</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">This usually takes a few seconds.</p>
      </div>
    </div>
  );
}

export default function TopicPanel() {
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);
  const dispatch = useDispatch();
  const [pollInterval, setPollInterval] = useState(0);
  const prevStatus = useRef(null);

  const { data: topic, isLoading, isError } = useGetTopicQuery(activeTopicId, {
    skip: !activeTopicId,
    pollingInterval: pollInterval,
  });

  useEffect(() => {
    const status = topic?.status;
    // When background research completes, patch the tree cache so sidebar updates
    if (prevStatus.current === 'researching' && status && status !== 'researching') {
      dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
        const id = String(activeTopicId);
        for (const folder of draft.main_topics ?? []) {
          for (const sub of folder.sub_topics ?? []) {
            if (String(sub.id) === id) { sub.status = status; return; }
          }
        }
        for (const t of draft.root_topics ?? []) {
          if (String(t.id) === id) { t.status = status; return; }
        }
      }));
    }
    prevStatus.current = status ?? null;
    setPollInterval(status === 'researching' ? 3000 : 0);
  }, [topic?.status, activeTopicId, dispatch]);

  if (!activeTopicId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600 select-none bg-white dark:bg-gray-950">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor"
            className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-700" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-base font-medium text-gray-500 dark:text-gray-400">Select a topic to get started</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Choose one from the sidebar or add a new one.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950">
        <svg className="animate-spin w-6 h-6 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (isError || !topic) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500 bg-white dark:bg-gray-950">
        <p className="text-sm">Failed to load topic. Please try again.</p>
      </div>
    );
  }

  if (topic.status === 'researching') {
    return (
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-950">
        <PanelHeader topic={topic} />
        <ResearchingState topicName={topic.name} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-gray-950">
      <PanelHeader topic={topic} />
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        <ResearchView research={topic.research} />
        <ChatThread topicId={topic.id} savedNotes={topic.notes ?? []} />
      </div>
      <ChatInput topicId={topic.id} topicName={topic.name} />
    </div>
  );
}
