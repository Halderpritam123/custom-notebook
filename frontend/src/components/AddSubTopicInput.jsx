import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { expandFolder, setActiveTopicId } from '../store/topicsSlice.js';
import { useCreateTopicMutation } from '../services/api.js';

export default function AddSubTopicInput({ parentId, onClose }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [createTopic, { isLoading }] = useCreateTopicMutation();
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }
    setError('');
    try {
      const result = await createTopic({ name: trimmed, parent_id: parentId }).unwrap();
      dispatch(expandFolder(parentId));
      dispatch(setActiveTopicId(result.id));
      onClose();
    } catch {
      setError('Failed to create sub-topic.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="pl-4 pr-3 pb-2">
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="Sub-topic name…"
          disabled={isLoading}
          className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 dark:border-gray-700
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     rounded focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="shrink-0 px-2 py-1 text-xs font-medium text-white bg-brand-500
                     rounded hover:bg-brand-600 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          {isLoading ? '…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="shrink-0 px-2 py-1 text-xs text-gray-500 dark:text-gray-400
                     rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </form>
  );
}
