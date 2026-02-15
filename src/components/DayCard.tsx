import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMoonEmoji, getMoonLabel, formatTime } from "@/lib/lunarUtils";
import TimeSlider from "./TimeSlider";
import AnalogClock from "./AnalogClock";

interface DayCardProps {
  date: Date;
  isActive: boolean;
  isOffDay: boolean;
  clockIn: string | null;
  clockOut: string | null;
  mainClockIn?: string | null;
  mainClockOut?: string | null;
  notice: string;
  shiftType: 'basic' | 'overtime' | 'notice_only';
  defaultClockIn?: string | null;
  defaultClockOut?: string | null;
  showOvertimeColumn: boolean;
  onToggle: () => void;
  onClockInChange: (time: string) => void;
  onClockOutChange: (time: string) => void;
  onMainClockInChange?: (time: string) => void;
  onMainClockOutChange?: (time: string) => void;
  onNoticeChange: (notice: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DayCard({
  date, isActive, isOffDay, clockIn, clockOut, mainClockIn, mainClockOut,
  notice, shiftType, defaultClockIn, defaultClockOut, showOvertimeColumn,
  onToggle, onClockInChange, onClockOutChange, onMainClockInChange, onMainClockOutChange, onNoticeChange
}: DayCardProps) {
  const [editingTime, setEditingTime] = useState<{ field: string; current: string } | null>(null);

  const dayIndex = (date.getDay() + 6) % 7; // Monday = 0
  const isWeekend = dayIndex >= 5;
  const moonEmoji = getMoonEmoji(date);
  const moonLabel = getMoonLabel(date);
  const isFullMoon = moonLabel === 'Full Moon';
  const isNewMoon = moonLabel === 'New Moon';
  const isMoonEve = moonLabel?.startsWith('Eve');

  const hasDefaultTime = !!defaultClockIn && !!defaultClockOut;

  const handleTimeClick = (field: string, current: string | null) => {
    if (isOffDay || !isActive) return;
    if (hasDefaultTime && current) {
      setEditingTime({ field, current });
    } else if (!hasDefaultTime) {
      setEditingTime({ field, current: current || '08:00' });
    }
  };

  const handleTimeChange = (time: string) => {
    if (!editingTime) return;
    switch (editingTime.field) {
      case 'clockIn': onClockInChange(time); break;
      case 'clockOut': onClockOutChange(time); break;
      case 'mainClockIn': onMainClockInChange?.(time); break;
      case 'mainClockOut': onMainClockOutChange?.(time); break;
    }
    setEditingTime(null);
  };

  const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

  if (isOffDay) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-off-day/50 opacity-60">
        <div className="w-16 text-center">
          <div className="text-xs font-medium text-off-day-foreground">{DAYS[dayIndex]}</div>
          <div className="text-xs text-off-day-foreground">{dateStr}</div>
        </div>
        <div className="flex-1 text-center text-xs text-off-day-foreground">Off Day</div>
        {moonEmoji && <span className="text-lg opacity-50">{moonEmoji}</span>}
      </div>
    );
  }

  if (shiftType === 'notice_only') {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
        isWeekend ? 'bg-weekend/10 border border-weekend/20' : 'glass-card'
      } ${isFullMoon ? 'lunar-glow' : ''} ${isNewMoon ? 'newmoon-glow' : ''}`}>
        <div className="w-16 text-center">
          <div className={`text-xs font-semibold ${isWeekend ? 'text-weekend' : 'text-foreground'}`}>{DAYS[dayIndex]}</div>
          <div className="text-xs text-muted-foreground">{dateStr}</div>
          {moonEmoji && <span className="text-sm">{moonEmoji}</span>}
        </div>
        <input
          type="text"
          value={notice}
          onChange={(e) => onNoticeChange(e.target.value)}
          placeholder="Notice..."
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
    );
  }

  return (
    <>
      <motion.div
        layout
        className={`rounded-2xl transition-all overflow-hidden ${
          isWeekend ? 'bg-weekend/10 border border-weekend/20' : 'glass-card'
        } ${isFullMoon ? 'lunar-glow' : ''} ${isNewMoon ? 'newmoon-glow' : ''} ${
          isMoonEve ? 'border-primary/20' : ''
        }`}
      >
        {/* Main row */}
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Day toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onToggle}
            className={`w-16 text-center rounded-xl py-1.5 transition-all ${
              isActive
                ? isWeekend ? 'bg-weekend text-weekend-foreground' : 'gradient-gold text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <div className="text-xs font-semibold">{DAYS[dayIndex]}</div>
            <div className="text-[10px] opacity-80">{dateStr}</div>
          </motion.button>

          {/* Moon indicator */}
          {moonEmoji && (
            <div className="flex flex-col items-center w-8">
              <span className={`text-base ${isFullMoon || isNewMoon ? 'animate-glow-pulse' : ''}`}>{moonEmoji}</span>
            </div>
          )}

          {/* Overtime main shift column */}
          {showOvertimeColumn && isActive && (
            <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
              <button
                onClick={() => handleTimeClick('mainClockIn', mainClockIn)}
                className="text-[10px] font-medium text-accent px-1.5 py-0.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
              >
                {formatTime(mainClockIn)}
              </button>
              <button
                onClick={() => handleTimeClick('mainClockOut', mainClockOut)}
                className="text-[10px] font-medium text-accent px-1.5 py-0.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
              >
                {formatTime(mainClockOut)}
              </button>
            </div>
          )}

          {/* Clock in/out */}
          {isActive ? (
            <div className="flex-1 flex items-center gap-2 justify-center">
              <button
                onClick={() => handleTimeClick('clockIn', clockIn)}
                className="text-sm font-medium text-success px-2 py-1 rounded-lg bg-success/10 hover:bg-success/20 transition-colors"
              >
                {formatTime(clockIn)}
              </button>
              <span className="text-muted-foreground text-xs">→</span>
              <button
                onClick={() => handleTimeClick('clockOut', clockOut)}
                className="text-sm font-medium text-weekend px-2 py-1 rounded-lg bg-weekend/10 hover:bg-weekend/20 transition-colors"
              >
                {formatTime(clockOut)}
              </button>
            </div>
          ) : (
            <div className="flex-1 text-center text-xs text-muted-foreground">Tap day to activate</div>
          )}

          {/* Notice */}
          {isActive && (
            <input
              type="text"
              value={notice}
              onChange={(e) => onNoticeChange(e.target.value)}
              placeholder="Note"
              className="w-20 bg-muted/50 rounded-lg px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-1 focus:ring-primary/30"
            />
          )}
        </div>

        {/* Moon label */}
        {moonLabel && (
          <div className={`px-4 pb-2 text-[10px] font-medium ${
            isFullMoon ? 'text-fullmoon' : isNewMoon ? 'text-newmoon' : 'text-muted-foreground'
          }`}>
            {moonLabel}
          </div>
        )}
      </motion.div>

      {/* Time picker modals */}
      {editingTime && hasDefaultTime && (
        <TimeSlider
          currentTime={editingTime.current}
          onTimeChange={handleTimeChange}
          onClose={() => setEditingTime(null)}
          label={editingTime.field.includes('In') ? 'Clock In' : 'Clock Out'}
        />
      )}
      {editingTime && !hasDefaultTime && (
        <AnalogClock
          onTimeSelect={handleTimeChange}
          onClose={() => setEditingTime(null)}
          label={editingTime.field.includes('In') ? 'Clock In' : 'Clock Out'}
        />
      )}
    </>
  );
}
