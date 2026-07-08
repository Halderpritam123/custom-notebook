const STATUS_STYLES = {
  researching: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  reading:     'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  reviewed:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export default function StatusBadge({ status, size = 'sm' }) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  const padding = size === 'md' ? 'px-2.5 py-0.5' : 'px-2 py-0.5';
  return (
    <span className={`${padding} rounded-full text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}
