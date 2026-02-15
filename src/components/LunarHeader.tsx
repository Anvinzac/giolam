import { useState } from "react";
import { getLunarPhase, formatTime, isAM } from "@/lib/lunarUtils";
import { Moon, Sun, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AnalogClock from "./AnalogClock";

interface LunarHeaderProps {
  userName: string;
  periodLabel?: string;
  defaultClockIn: string | null;
  defaultClockOut: string | null;
  useDefaultTime: boolean;
  onToggleDefault: () => void;
  onDefaultClockInChange: (time: string) => void;
  onDefaultClockOutChange: (time: string) => void;
}

export default function LunarHeader({
  userName, periodLabel, defaultClockIn, defaultClockOut,
  useDefaultTime, onToggleDefault, onDefaultClockInChange, onDefaultClockOutChange
}: LunarHeaderProps) {
  const phase = getLunarPhase(new Date());
  const isFullish = Math.abs(phase - 0.5) < 0.15;
  const [expanded, setExpanded] = useState(false);
  const [editingField, setEditingField] = useState<'in' | 'out' | null>(null);

  const timeColor = (t: string | null) => isAM(t) ? 'text-success' : 'text-accent';

  return (
    <>
      <header className="relative overflow-hidden px-4 pt-10 pb-4">
        {/* Background glow */}
        <div className={`absolute inset-0 opacity-30 ${isFullish ? 'lunar-glow' : 'newmoon-glow'}`} />
        <div className="absolute top-2 right-4 opacity-15">
          {isFullish ? (
            <Sun className="w-20 h-20 text-fullmoon animate-float" />
          ) : (
            <Moon className="w-20 h-20 text-newmoon animate-float" />
          )}
        </div>

        <div className="relative z-10 flex items-start justify-between">
          {/* Left side */}
          <div>
            <h1 className="font-display text-xl font-bold text-gradient-gold">LunarFlow</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Xin chào, {userName}</p>
            {periodLabel && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                <div className="w-1.5 h-1.5 rounded-full gradient-gold animate-glow-pulse" />
                <span className="text-[10px] font-medium text-primary">{periodLabel}</span>
              </div>
            )}
          </div>

          {/* Right side — clock settings */}
          <div className="flex flex-col items-end">
            {/* Autofill toggle — on top, overlapping with time */}
            {defaultClockIn && (
              <button
                onClick={onToggleDefault}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-t-xl text-xs font-semibold transition-colors border border-b-0 ${
                  useDefaultTime
                    ? 'bg-primary/20 text-primary border-primary/25'
                    : 'bg-muted/60 text-muted-foreground border-glass-border'
                }`}
              >
                <div className={`w-3 h-3 rounded border-2 flex items-center justify-center transition-colors ${
                  useDefaultTime ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'
                }`}>
                  {useDefaultTime && <Check size={8} className="text-primary-foreground" strokeWidth={3} />}
                </div>
                {useDefaultTime ? 'Tự điền' : 'Thủ công'}
              </button>
            )}

            {/* Time display button — connected below */}
            <button
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors hover:bg-card/80 border border-glass-border ${
                defaultClockIn ? 'rounded-b-xl rounded-tl-xl bg-card/60' : 'rounded-xl bg-card/60'
              }`}
            >
              <Clock size={14} className="text-primary" />
              {defaultClockIn && defaultClockOut ? (
                <span className="font-medium">
                  <span className={timeColor(defaultClockIn)}>{formatTime(defaultClockIn)}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className={timeColor(defaultClockOut)}>{formatTime(defaultClockOut)}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Chưa đặt giờ</span>
              )}
              {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Expanded time settings */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden relative z-10"
            >
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditingField('in')}
                  className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-card/60 border border-glass-border hover:border-success/30 transition-colors"
                >
                  <span className="text-[10px] text-muted-foreground">Giờ vào</span>
                  <span className={`text-lg font-display font-bold ${defaultClockIn ? timeColor(defaultClockIn) : 'text-muted-foreground'}`}>
                    {defaultClockIn ? formatTime(defaultClockIn) : '--:--'}
                  </span>
                </button>
                <button
                  onClick={() => setEditingField('out')}
                  className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-card/60 border border-glass-border hover:border-accent/30 transition-colors"
                >
                  <span className="text-[10px] text-muted-foreground">Giờ ra</span>
                  <span className={`text-lg font-display font-bold ${defaultClockOut ? timeColor(defaultClockOut) : 'text-muted-foreground'}`}>
                    {defaultClockOut ? formatTime(defaultClockOut) : '--:--'}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Celestial clock modal */}
      {editingField && (
        <AnalogClock
          onTimeSelect={(time) => {
            if (editingField === 'in') onDefaultClockInChange(time);
            else onDefaultClockOutChange(time);
            setEditingField(null);
          }}
          onClose={() => setEditingField(null)}
          label={editingField === 'in' ? 'Giờ vào mặc định' : 'Giờ ra mặc định'}
        />
      )}
    </>
  );
}
