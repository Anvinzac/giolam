import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMoonEmoji, getMoonLabel, formatTime, isAM } from "@/lib/lunarUtils";
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

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function DayCard({
  date, isActive, isOffDay, clockIn, clockOut, mainClockIn, mainClockOut,
  notice, shiftType, defaultClockIn, defaultClockOut, showOvertimeColumn,
  onToggle, onClockInChange, onClockOutChange, onMainClockInChange, onMainClockOutChange, onNoticeChange
}: DayCardProps) {
  const [editingTime, setEditingTime] = useState<{ field: string; current: string } | null>(null);
  const [expandedNote, setExpandedNote] = useState(false);

  const dayIndex = (date.getDay() + 6) % 7;
  const isSaturday = dayIndex === 5;
  const isSunday = dayIndex === 6;
  const isWeekend = isSaturday || isSunday;
  const moonEmoji = getMoonEmoji(date);
  const moonLabel = getMoonLabel(date);
  const isFullMoon = moonLabel === 'Full Moon';
  const isNewMoon = moonLabel === 'New Moon';
  const isMoonEve = moonLabel?.startsWith('Chay');

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

  const dateNum = date.getDate();
  const divider = "border-r border-border";

  const timeColor = (t: string | null) => isAM(t) ? 'text-success' : 'text-accent';

  // Weekend-aware colors
  const weekendBg = isSunday ? 'bg-sunday/10 border border-sunday/20' : 'bg-saturday/10 border border-saturday/20';
  const weekendText = isSunday ? 'text-sunday' : 'text-saturday';
  const weekendActiveBg = isSunday ? 'bg-sunday text-sunday-foreground' : 'bg-saturday text-saturday-foreground';

  // Moon badge shown below the date number, not crammed beside it
  const moonBadge = moonEmoji ? (
    <span className={`text-xs mt-0.5 block ${isFullMoon || isNewMoon ? 'animate-glow-pulse' : ''}`}>{moonEmoji}</span>
  ) : null;

  const moonLabelEl = moonLabel ? (
    <span className={`text-[7px] font-semibold leading-none mt-0.5 block ${
      isFullMoon ? 'text-fullmoon' : isNewMoon ? 'text-newmoon' : 'text-primary'
    }`}>{moonLabel}</span>
  ) : null;

  if (isOffDay) {
    return (
      <div className="flex items-stretch rounded-xl bg-off-day/50 opacity-60 overflow-hidden min-h-[40px]">
        <div className={`flex flex-col items-center justify-center w-16 py-1 ${divider}`}>
          <span className="text-xs font-medium text-off-day-foreground">{DAYS[dayIndex]}</span>
          <span className="text-[10px] text-off-day-foreground">{dateNum}</span>
          {moonBadge}
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-off-day-foreground">Nghỉ</div>
      </div>
    );
  }

  if (shiftType === 'notice_only') {
    return (
      <div className={`flex items-stretch rounded-xl overflow-hidden min-h-[40px] ${
        isWeekend ? weekendBg : 'bg-card/60 border border-glass-border'
      }`}>
        <div className={`flex flex-col items-center justify-center w-16 py-1 ${divider}`}>
          <span className={`text-xs font-semibold ${isWeekend ? weekendText : 'text-foreground'}`}>{DAYS[dayIndex]}</span>
          <span className="text-[10px] text-muted-foreground">{dateNum}</span>
          {moonBadge}
          {moonLabelEl}
        </div>
        <input
          type="text"
          value={notice}
          onChange={(e) => onNoticeChange(e.target.value)}
          placeholder="Ghi chú..."
          className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground px-2"
        />
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-xl overflow-visible transition-all ${
        isWeekend ? weekendBg : 'bg-card/60 border border-glass-border'
      } ${isFullMoon ? 'lunar-glow' : ''} ${isNewMoon ? 'newmoon-glow' : ''} ${
        isMoonEve ? 'border-primary/30' : ''
      }`}>
        <div className="flex items-stretch min-h-[36px]">
          {/* Day toggle */}
          <button
            onClick={onToggle}
            className={`w-16 flex flex-col items-center justify-center py-1 rounded-l-xl ${divider} transition-all ${
              isActive
                ? isWeekend ? weekendActiveBg : 'gradient-gold text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className="text-sm font-bold leading-none">{DAYS[dayIndex]}</span>
            <span className="text-xs opacity-80">{dateNum}</span>
            {moonBadge}
            {moonLabelEl}
          </button>

          {/* Overtime main shift column */}
          {showOvertimeColumn && isActive && (
            <div className={`flex flex-col items-center justify-center w-12 ${divider} gap-0.5 py-1`}>
              <button
                onClick={() => handleTimeClick('mainClockIn', mainClockIn)}
                className={`text-[10px] font-medium ${timeColor(mainClockIn)}`}
              >
                {formatTime(mainClockIn)}
              </button>
              <button
                onClick={() => handleTimeClick('mainClockOut', mainClockOut)}
                className={`text-[10px] font-medium ${timeColor(mainClockOut)}`}
              >
                {formatTime(mainClockOut)}
              </button>
            </div>
          )}

          {/* Clock in/out */}
          {isActive ? (
            <>
              <button
                onClick={() => handleTimeClick('clockIn', clockIn)}
                className={`flex-1 flex items-center justify-center ${divider} text-sm font-semibold ${timeColor(clockIn)} hover:bg-success/5 transition-colors`}
              >
                {formatTime(clockIn)}
              </button>
              <button
                onClick={() => handleTimeClick('clockOut', clockOut)}
                className={`flex-1 flex items-center justify-center ${divider} text-sm font-semibold ${timeColor(clockOut)} hover:bg-accent/5 transition-colors`}
              >
                {formatTime(clockOut)}
              </button>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center text-[10px] text-muted-foreground ${divider}`}>
              Chạm ngày để bật
            </div>
          )}

          {/* Note trigger — small icon */}
          <button
            onClick={() => setExpandedNote(!expandedNote)}
            className={`w-8 flex items-center justify-center rounded-r-xl transition-colors ${
              notice ? 'text-primary' : 'text-muted-foreground'
            } hover:bg-muted/30`}
            title={isActive ? 'Ghi chú' : 'Lý do nghỉ'}
          >
            <span className="text-xs">📝</span>
          </button>
        </div>

        {/* Notice text row — spans full width */}
        {notice && !expandedNote && (
          <div className="px-2 py-1 border-t border-border">
            <p className="text-[11px] text-muted-foreground leading-snug">{notice}</p>
          </div>
        )}

        {/* Expanded note input */}
        <AnimatePresence>
          {expandedNote && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="p-2">
                <input
                  type="text"
                  value={notice}
                  onChange={(e) => onNoticeChange(e.target.value)}
                  placeholder={isActive ? "Nhập ghi chú..." : "Lý do nghỉ..."}
                  autoFocus
                  onBlur={() => setTimeout(() => setExpandedNote(false), 150)}
                  className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Time picker modals */}
      {editingTime && hasDefaultTime && (
        <TimeSlider
          currentTime={editingTime.current}
          onTimeChange={handleTimeChange}
          onClose={() => setEditingTime(null)}
          label={editingTime.field.includes('In') ? 'Giờ vào' : 'Giờ ra'}
        />
      )}
      {editingTime && !hasDefaultTime && (
        <AnalogClock
          onTimeSelect={handleTimeChange}
          onClose={() => setEditingTime(null)}
          label={editingTime.field.includes('In') ? 'Giờ vào' : 'Giờ ra'}
        />
      )}
    </>
  );
}
