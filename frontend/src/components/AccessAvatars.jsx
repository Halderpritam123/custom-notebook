/**
 * AccessAvatars — shows circular initials avatars for each share recipient.
 * Only rendered for the topic owner; hidden for recipients in read-only mode.
 *
 * Props:
 *   recipients  — array of { id, recipient_email } share objects
 *   isOwner     — boolean; render nothing if false
 *   onOpenDialog — called when any avatar or overflow is clicked
 */
export default function AccessAvatars({ recipients, isOwner, onOpenDialog }) {
  if (!isOwner || !recipients?.length) return null;

  const visible = recipients.slice(0, 3);
  const overflow = recipients.length - 3;

  const avatarClass =
    'w-7 h-7 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 ' +
    'flex items-center justify-center text-xs font-medium cursor-pointer ' +
    'hover:ring-2 hover:ring-brand-400 transition-shadow select-none';

  return (
    <div className="flex items-center gap-1" aria-label="Shared with">
      {visible.map((share) => {
        const email = share.recipient_email ?? '';
        const initial = email.length > 0 ? email[0].toUpperCase() : '?';
        return (
          <span
            key={share.id}
            className={avatarClass}
            title={email}
            onClick={onOpenDialog}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDialog(); }}
            aria-label={`Shared with ${email}`}
          >
            {initial}
          </span>
        );
      })}

      {overflow > 0 && (
        <span
          className={avatarClass}
          title={`${overflow} more recipient${overflow > 1 ? 's' : ''}`}
          onClick={onOpenDialog}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDialog(); }}
          aria-label={`${overflow} more recipients`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
