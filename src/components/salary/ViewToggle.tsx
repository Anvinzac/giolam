export type ViewMode = 'table' | 'immersive';

export interface ViewToggleProps {
  currentView: ViewMode;
  onToggle: (view: ViewMode) => void;
}

export default function ViewToggle({ currentView, onToggle }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-lg border border-border/40">
      <button
        onClick={() => onToggle('table')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium
          transition-all duration-200
          ${currentView === 'table'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
      >
        Bảng
      </button>
      <button
        onClick={() => onToggle('immersive')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium
          transition-all duration-200
          ${currentView === 'immersive'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
      >
        Thẻ
      </button>
    </div>
  );
}
