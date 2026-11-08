import { useEffect, useRef, useState } from 'react';

interface AppBootStateProps {
  error?: string | null;
  onRetry?: () => void;
}

const MAX_RETRY_DELAY_MS = 30_000;

export default function AppBootState({ error, onRetry }: AppBootStateProps) {
  // Pages keep this component mounted while they retry, so the count survives
  // the error → loading → error cycle and the backoff keeps growing.
  const attempts = useRef(0);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  const [retrying, setRetrying] = useState(false);

  // Keep retrying with exponential backoff (1s, 2s, 4s … capped at 30s) instead
  // of giving up on a transient failure. Pages clear `error` when a retry starts,
  // so each new failure re-runs this effect.
  useEffect(() => {
    if (!error || !retryRef.current) return;
    const delay = Math.min(1000 * 2 ** attempts.current, MAX_RETRY_DELAY_MS);
    attempts.current += 1;
    setRetrying(true);
    const timer = setTimeout(() => retryRef.current?.(), delay);
    return () => clearTimeout(timer);
  }, [error]);

  if (!error || onRetry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-6">
        <div className="w-8 h-8 rounded-full gradient-gold animate-glow-pulse" />
        {retrying && <p className="text-xs text-muted-foreground">Đang thử kết nối lại…</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h2 className="font-display text-lg font-semibold text-foreground">Couldn&apos;t load this page</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    </div>
  );
}
