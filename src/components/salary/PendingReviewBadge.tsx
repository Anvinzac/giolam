interface PendingReviewBadgeProps {
  count: number;
  variant?: 'dot' | 'count';
  className?: string;
}

/**
 * Small visual indicator for admin that an employee has pending
 * (unreviewed) self-submitted salary entries.
 *   - `dot`  → a red bullet only
 *   - `count` → pill with count text, e.g. "3 chờ duyệt"
 */
export default function PendingReviewBadge({
  count,
  variant = 'dot',
  className = '',
}: PendingReviewBadgeProps) {
  if (count <= 0) return null;

  if (variant === 'dot') {
    return (
      <span
        aria-label={`${count} dòng chờ duyệt`}
        className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ${className}`}
      >
        {count > 9 ? '9+' : count}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold ${className}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
      {count} chờ duyệt
    </span>
  );
}
