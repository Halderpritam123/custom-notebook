import { useEffect, useRef } from 'react';

/**
 * A themed confirmation dialog that replaces window.confirm.
 *
 * Props:
 *   open        — boolean, whether to show
 *   title       — heading text
 *   message     — body text
 *   confirmLabel — button label (default "Delete")
 *   onConfirm   — called when user confirms
 *   onCancel    — called when user cancels
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  // Focus cancel button on open for keyboard accessibility
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-title"
    >
      {/* Panel */}
      <div
        className="w-full max-w-sm rounded-xl shadow-xl
                   bg-white dark:bg-gray-900
                   border border-gray-200 dark:border-gray-700
                   p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full
                          bg-red-100 dark:bg-red-900/30">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
            {message && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg
                       text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-800
                       hover:bg-gray-200 dark:hover:bg-gray-700
                       transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg
                       text-white
                       bg-red-600 hover:bg-red-700
                       dark:bg-red-600 dark:hover:bg-red-500
                       transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
