import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatTime, timeToString } from "@/lib/lunarUtils";

interface TimeSliderProps {
  currentTime: string; // HH:MM
  onTimeChange: (time: string) => void;
  onClose: () => void;
  label: string;
}

const SEGMENT_MINUTES = 30;
const RANGE_HOURS = 2;
const SEGMENTS = (RANGE_HOURS * 2 * 2) + 1; // 9 segments

function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(':').map(Number);
  return { hours: h, minutes: m };
}

function addMinutes(hours: number, minutes: number, add: number) {
  let total = hours * 60 + minutes + add;
  if (total < 0) total = 0;
  if (total > 23 * 60 + 30) total = 23 * 60 + 30;
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export default function TimeSlider({ currentTime, onTimeChange, onClose, label }: TimeSliderProps) {
  const base = parseTime(currentTime);
  const [selectedIndex, setSelectedIndex] = useState(Math.floor(SEGMENTS / 2));

  const segments = Array.from({ length: SEGMENTS }, (_, i) => {
    const offset = (i - Math.floor(SEGMENTS / 2)) * SEGMENT_MINUTES;
    return addMinutes(base.hours, base.minutes, offset);
  });

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
    const seg = segments[index];
    onTimeChange(timeToString(seg.hours, seg.minutes));
  }, [segments, onTimeChange]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm glass-card p-6 pb-8 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-foreground">{label}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Done
            </button>
          </div>
          
          <div className="flex flex-col gap-1.5">
            {segments.map((seg, i) => {
              const isSelected = i === selectedIndex;
              const isCenter = i === Math.floor(SEGMENTS / 2);
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelect(i)}
                  className={`
                    relative flex items-center justify-center py-3 rounded-xl text-sm font-medium transition-all duration-200
                    ${isSelected 
                      ? 'gradient-gold text-primary-foreground shadow-lg' 
                      : isCenter
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }
                  `}
                >
                  {formatTime(timeToString(seg.hours, seg.minutes))}
                  {isCenter && !isSelected && (
                    <span className="absolute right-3 text-xs text-muted-foreground">current</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
