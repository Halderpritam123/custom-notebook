import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetTopicQuery, useUpdateTopicStatusMutation, apiSlice, useGetSharesForResourceQuery } from '../services/api.js';
import { useResearchStream } from '../hooks/useResearchStream.js';
import StatusBadge from './shared/StatusBadge.jsx';
import ResearchView from './ResearchView.jsx';
import ChatThread from './ChatThread.jsx';
import ChatInput from './ChatInput.jsx';
import AccessAvatars from './AccessAvatars.jsx';
import ShareDialog from './ShareDialog.jsx';

function PanelHeader({ topic, isReadOnly }) {
  const [updateTopicStatus, { isLoading: isUpdating }] = useUpdateTopicStatusMutation();
  const handleMarkReviewed = async () => {
    try { await updateTopicStatus({ id: topic.id, status: 'reviewed' }).unwrap(); } catch {}
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{topic.name}</h2>
        <StatusBadge status={topic.status} />
        {isReadOnly && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                           bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            Read-only
          </span>
        )}
      </div>
      {!isReadOnly && topic.status === 'reading' && (
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
  const isReadOnly = useSelector((state) => state.topics.isReadOnly);
  const authUserId = useSelector((state) => state.auth.userId);
  const dispatch = useDispatch();

  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const { data: topic, isLoading, isError } = useGetTopicQuery(activeTopicId, {
    skip: !activeTopicId,
  });

  // Fetch shares for the active topic (only when we have a topic loaded)
  const { data: sharesData = [] } = useGetSharesForResourceQuery(topic?.id, {
    skip: !topic?.id || isReadOnly,
  });

  // Determine ownership: compare topic.user_id with auth userId
  const isOwner = !isReadOnly && !!topic?.user_id && !!authUserId && topic.user_id === authUserId;

  // Close share dialog when active topic changes
  useEffect(() => {
    setShareDialogOpen(false);
  }, [activeTopicId]);

  // SSE: when research completes, refetch topic + patch tree cache — no polling
  useResearchStream(activeTopicId, topic?.status, (newStatus) => {
    dispatch(apiSlice.util.invalidateTags([{ type: 'Topic', id: activeTopicId }]));
    dispatch(apiSlice.util.updateQueryData('getTopicTree', undefined, (draft) => {
      const id = String(activeTopicId);
      function patch(nodes) {
        for (const n of nodes ?? []) {
          if (String(n.id) === id) { n.status = newStatus; return true; }
          if (n.is_folder && patch(n.children)) return true;
        }
        return false;
      }
      patch(draft.nodes);
    }));
  });

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
        <PanelHeader topic={topic} isReadOnly={isReadOnly} />
        <ResearchingState topicName={topic.name} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-gray-950">
      {/* Header row with title, badges, and access avatars */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{topic.name}</h2>
          <StatusBadge status={topic.status} />
          {isReadOnly && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                             bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3" aria-hidden="true">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Share button + access avatars — owner only, not shown in read-only mode */}
          {isOwner && (
            <div className="flex items-center gap-1.5">
              <AccessAvatars
                recipients={sharesData}
                isOwner={isOwner}
                onOpenDialog={() => setShareDialogOpen(true)}
              />
              {/* Always-visible share button for owners */}
              <button
                type="button"
                onClick={() => setShareDialogOpen(true)}
                title="Share this topic"
                className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500
                           hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400
                           transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
                </svg>
              </button>
            </div>
          )}

          {/* Mark as reviewed button */}
          {!isReadOnly && topic.status === 'reading' && (
            <MarkReviewedButton topicId={topic.id} status={topic.status} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        <ResearchView
            topicId={topic.id}
            research={topic.research}
            isReadOnly={isReadOnly}
            onResearchUpdated={(updated) => {
              dispatch(apiSlice.util.updateQueryData('getTopic', activeTopicId, (draft) => {
                if (draft) draft.research = updated;
              }));
            }}
          />
        <ChatThread topicId={topic.id} savedNotes={topic.notes ?? []} isReadOnly={isReadOnly} />
      </div>
      {!isReadOnly && <ChatInput topicId={topic.id} topicName={topic.name} />}

      {/* Share dialog */}
      <ShareDialog
        resourceId={topic?.id}
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
      />
    </div>
  );
}

// Extracted to keep the main panel clean
function MarkReviewedButton({ topicId }) {
  const [updateTopicStatus, { isLoading: isUpdating }] = useUpdateTopicStatusMutation();
  const handleMarkReviewed = async () => {
    try { await updateTopicStatus({ id: topicId, status: 'reviewed' }).unwrap(); } catch {}
  };
  return (
    <button type="button" onClick={handleMarkReviewed} disabled={isUpdating}
      className="shrink-0 px-4 py-2 text-sm font-medium text-white
                 bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-400">
      {isUpdating ? 'Saving…' : 'Mark as Reviewed'}
    </button>
  );
}
