import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { expandFolder } from '../store/topicsSlice.js';
import { useCreateMainTopicMutation } from '../services/api.js';

export default function AddMainTopicInput() {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [createMainTopic, { isLoading }] = useCreateMainTopicMutation();
  const trimmed = name.trim();
  const isDisabled = trimmed.length === 0 || isLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }
    setError('');
    try {
      const result = await createMainTopic({ name: trimmed }).unwrap();
      dispatch(expandFolder(result.id));
      setName('');
    } catch {
      setError('Failed to create folder.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="Add a folder…"
          disabled={isLoading}
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={isDisabled}
          className="shrink-0 px-3 py-2 text-sm font-medium text-white bg-brand-500
                     rounded-lg hover:bg-brand-600 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          {isLoading ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Adding…
            </span>
          ) : 'Add'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </form>
  );
}
