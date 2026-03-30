interface AppBootStateProps {
  error?: string | null;
  onRetry?: () => void;
}

export default function AppBootState({ error, onRetry }: AppBootStateProps) {
  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h2 className="font-display text-lg font-semibold text-foreground">Couldn&apos;t load this page</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center justify-center rounded-xl gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
