import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setActiveTopicId, setReadOnly } from '../store/topicsSlice.js';
import { useGetSharedWithMeQuery, useLeaveShareMutation } from '../services/api.js';

function FileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true">
      <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V16.5A1.5 1.5 0 0113.5 18h-9A1.5 1.5 0 013 16.5v-13z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className="w-4 h-4 shrink-0 text-amber-400 dark:text-amber-500" aria-hidden="true">
      <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
    </svg>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className={`w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      aria-hidden="true">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

// Recursive read-only node renderer
function SharedNode({ node, depth = 0, activeTopicId }) {
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);
  const indent = 12 + depth * 12;

  const handleClick = () => {
    if (node.is_folder) {
      setExpanded((prev) => !prev);
    } else {
      dispatch(setActiveTopicId(node.id));
      dispatch(setReadOnly(true));
    }
  };

  const isActive = !node.is_folder && node.id === activeTopicId;

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        style={{ paddingLeft: `${indent}px` }}
        className={`flex items-center gap-2 pr-3 py-2.5 cursor-pointer transition-colors
          hover:bg-gray-100 dark:hover:bg-gray-800/60
          ${isActive
            ? 'bg-brand-50 border-l-4 border-brand-500 dark:bg-brand-900/20 dark:border-brand-400'
            : 'border-l-4 border-transparent'}`}
      >
        {node.is_folder && <ChevronIcon expanded={expanded} />}
        {node.is_folder ? <FolderIcon /> : <FileIcon />}
        <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 truncate select-none">
          {node.name}
        </span>
        {/* Read-only lock indicator */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className="w-3 h-3 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden="true" title="Read-only">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
        </svg>
      </div>

      {node.is_folder && expanded && node.children?.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <SharedNode key={child.id} node={child} depth={depth + 1} activeTopicId={activeTopicId} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Collapsible owner group
function OwnerGroup({ group, activeTopicId }) {
  const [expanded, setExpanded] = useState(true);
  const [leaveShare, { isLoading: isLeaving }] = useLeaveShareMutation();
  const dispatch = useDispatch();

  const handleLeave = async (e) => {
    e.stopPropagation();
    // Remove all share records from this owner for this recipient
    try {
      for (const shareId of group.share_ids) {
        await leaveShare({ shareId }).unwrap();
      }
      // If viewing a shared topic, clear active selection
      dispatch(setActiveTopicId(null));
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center w-full">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex-1 flex items-center gap-1.5 px-3 py-2 text-left
                     text-xs font-medium text-gray-500 dark:text-gray-400
                     hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
        >
          <ChevronIcon expanded={expanded} />
          <span className="truncate">{group.owner_email}</span>
        </button>
        <button
          type="button"
          onClick={handleLeave}
          disabled={isLeaving}
          title="Remove this shared access"
          className="shrink-0 mr-2 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400
                     transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1"
        >
          {isLeaving ? '…' : 'Leave'}
        </button>
      </div>

      {expanded && group.nodes?.length > 0 && (
        <ul>
          {group.nodes.map((node) => (
            <SharedNode key={node.id} node={node} depth={1} activeTopicId={activeTopicId} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SharedWithMeSection() {
  const { data, isLoading } = useGetSharedWithMeQuery();
  const activeTopicId = useSelector((state) => state.topics.activeTopicId);

  // Return null when loading or no data
  if (isLoading || !data?.length) return null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 pt-2">
      <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        Shared with me
      </p>
      {data.map((group) => (
        <OwnerGroup key={group.owner_id} group={group} activeTopicId={activeTopicId} />
      ))}
    </div>
  );
}
