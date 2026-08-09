import { useEffect, useRef, useState } from 'react';
import {
  useSearchUsersQuery,
  useGetSharesForResourceQuery,
  useCreateShareMutation,
  useRevokeShareMutation,
} from '../services/api.js';

export default function ShareDialog({ resourceId, open, onClose }) {
  const [query, setQuery] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const inputRef = useRef(null);

  // Reset local state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setQuery('');
      setPendingUser(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const { data: searchResults = [], isFetching: isSearching } = useSearchUsersQuery(query, {
    skip: query.length < 2,
  });

  const { data: currentShares = [], isLoading: sharesLoading } = useGetSharesForResourceQuery(
    resourceId,
    { skip: !resourceId },
  );

  const [createShare, { isLoading: isSharing, isError: shareError }] = useCreateShareMutation();
  const [revokeShare, { isLoading: isRevoking }] = useRevokeShareMutation();

  const handleShare = async () => {
    if (!pendingUser) return;
    try {
      await createShare({ resourceId, recipientId: pendingUser.id }).unwrap();
      setPendingUser(null);
      setQuery('');
    } catch {}
  };

  const handleRevoke = async (share) => {
    try {
      await revokeShare({ shareId: share.id, resourceId }).unwrap();
    } catch {}
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  // Filter out already-shared users from search results
  const sharedRecipientIds = new Set(currentShares.map((s) => s.recipient_id));
  const filteredResults = searchResults.filter((u) => !sharedRecipientIds.has(u.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Share dialog"
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Share</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
            aria-label="Close dialog"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Add people
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPendingUser(null); }}
              placeholder="Search by email…"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                         placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            {isSearching && (
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-brand-400"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
          </div>
        </div>

        {/* Search results */}
        {query.length >= 2 && filteredResults.length > 0 && (
          <ul className="mb-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 max-h-40 overflow-y-auto">
            {filteredResults.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => { setPendingUser(user); setQuery(user.email); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors
                    ${pendingUser?.id === user.id
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60'}`}
                >
                  {user.email}
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && !isSearching && filteredResults.length === 0 && (
          <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">No users found.</p>
        )}

        {/* Pending selection + share button */}
        {pendingUser && (
          <div className="flex items-center gap-2 mb-4">
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
              Share with <strong>{pendingUser.email}</strong>
            </span>
            <button
              type="button"
              onClick={handleShare}
              disabled={isSharing}
              className="shrink-0 px-3 py-1.5 text-sm font-medium text-white
                         bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {isSharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
        )}

        {shareError && (
          <p className="mb-3 text-xs text-red-500">Failed to share. Please try again.</p>
        )}

        {/* Current recipients */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {sharesLoading ? 'Loading…' : currentShares.length === 0 ? 'Not shared with anyone yet.' : 'Shared with'}
          </p>
          {!sharesLoading && currentShares.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {currentShares.map((share) => (
                <li key={share.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {share.recipient_email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevoke(share)}
                    disabled={isRevoking}
                    className="shrink-0 ml-2 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400
                               transition-colors focus:outline-none focus:ring-1 focus:ring-red-400 rounded
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
