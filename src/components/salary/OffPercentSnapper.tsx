import { motion } from 'framer-motion';

interface OffPercentSnapperProps {
  value: number;
  onChange: (value: number) => void;
}

const SNAPS = [25, 50, 75, 100];

export default function OffPercentSnapper({ value, onChange }: OffPercentSnapperProps) {
  const activeIdx = SNAPS.indexOf(value);

  return (
    <div className="flex items-center gap-1 py-1.5">
      <div className="relative flex items-center w-full h-8">
        {/* Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-3 right-3 h-0.5 bg-border rounded-full" />

        {/* Active track */}
        {activeIdx > 0 && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 left-3 h-0.5 bg-destructive/60 rounded-full"
            animate={{ width: `${(activeIdx / (SNAPS.length - 1)) * (100 - 6)}%` }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}

        {/* Snap points */}
        {SNAPS.map((snap, idx) => {
          const isActive = snap === value;
          const pct = (idx / (SNAPS.length - 1)) * 100;
          return (
            <button
              key={snap}
              onClick={() => onChange(snap)}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10"
              style={{ left: `calc(${pct}% * 0.88 + 6%)` }}
            >
              <motion.div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isActive
                    ? 'border-destructive bg-destructive text-white'
                    : 'border-border bg-background'
                }`}
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </motion.div>
              <span className={`text-[9px] mt-0.5 font-medium ${
                isActive ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {snap}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
