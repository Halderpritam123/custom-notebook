import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSendChatMessageMutation } from '../services/api.js';
import { addMessage } from '../store/chatSlice.js';

export default function ChatInput({ topicId, topicName }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const session = useSelector((state) => state.chat.sessions[topicId] ?? []);
  const [sendChatMessage, { isLoading }] = useSendChatMessageMutation();
  const canSubmit = text.trim().length > 0 && !isLoading;

  const handleSubmit = async () => {
    const message = text.trim();
    if (!message) return;
    setError(null);
    const history = session.slice(-10);
    dispatch(addMessage({ topicId, message: { role: 'user', content: message } }));
    setText('');
    try {
      const result = await sendChatMessage({ topicId, message, history }).unwrap();
      dispatch(addMessage({ topicId, message: { role: 'assistant', content: result.reply } }));
    } catch {
      setError('Failed to get a reply. Please try again.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
      {error && <p role="alert" className="text-xs text-red-500 mb-2">{error}</p>}
      <div className="flex items-end gap-3">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={`Ask a follow-up about "${topicName}"… (Enter to send, Shift+Enter for new line)`}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-700
                     bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                     placeholder-gray-400 dark:placeholder-gray-500
                     px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                     disabled:bg-gray-50 dark:disabled:bg-gray-800/50 disabled:text-gray-400
                     transition-colors"
          aria-label="Chat message input"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Send message"
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl
                     bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {isLoading ? (
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
