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
  const isWeekend = dayIndex >= 5;
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

  // Time color: bright for AM, dim for PM
  const timeColor = (t: string | null) => isAM(t) ? 'text-success' : 'text-weekend';

  if (isOffDay) {
    return (
      <div className="flex items-stretch rounded-xl bg-off-day/50 opacity-60 overflow-hidden h-10">
        <div className={`flex items-center justify-center w-14 ${divider}`}>
          <div className="text-[11px] font-medium text-off-day-foreground leading-tight text-center">
            <div>{DAYS[dayIndex]}</div>
            <div className="text-[10px]">{dateNum}</div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-off-day-foreground">Nghỉ</div>
      </div>
    );
  }

  if (shiftType === 'notice_only') {
    return (
      <div className={`flex items-stretch rounded-xl overflow-hidden h-10 ${
        isWeekend ? 'bg-weekend/10 border border-weekend/20' : 'bg-card/60 border border-glass-border'
      }`}>
        <div className={`flex items-center justify-center w-14 ${divider}`}>
          <div className={`text-[11px] font-semibold leading-tight text-center ${isWeekend ? 'text-weekend' : 'text-foreground'}`}>
            <div>{DAYS[dayIndex]}</div>
            <div className="flex items-center gap-0.5 justify-center">
              <span className="text-[10px] text-muted-foreground">{dateNum}</span>
              {moonEmoji && <span className="text-[10px]">{moonEmoji}</span>}
            </div>
          </div>
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
      <div className={`rounded-xl overflow-hidden transition-all ${
        isWeekend ? 'bg-weekend/10 border border-weekend/20' : 'bg-card/60 border border-glass-border'
      } ${isFullMoon ? 'lunar-glow' : ''} ${isNewMoon ? 'newmoon-glow' : ''} ${
        isMoonEve ? 'border-primary/30' : ''
      }`}>
        {/* Main row */}
        <div className="flex items-stretch min-h-[40px]">
          {/* Day toggle */}
          <button
            onClick={onToggle}
            className={`w-14 flex flex-col items-center justify-center ${divider} transition-all overflow-visible relative ${
              isActive
                ? isWeekend ? 'bg-weekend text-weekend-foreground' : 'gradient-gold text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className="text-[11px] font-bold">{DAYS[dayIndex]}</span>
            <span className="flex items-center gap-0.5">
              <span className="text-[10px] opacity-80">{dateNum}</span>
              {moonEmoji && <span className={`text-[10px] ${isFullMoon || isNewMoon ? 'animate-glow-pulse' : ''}`}>{moonEmoji}</span>}
            </span>
            {moonLabel && (
              <span className={`text-[7px] font-medium leading-none ${
                isFullMoon ? 'text-fullmoon' : isNewMoon ? 'text-newmoon' : isActive ? 'opacity-80' : 'text-primary'
              }`}>{moonLabel}</span>
            )}
          </button>

          {/* Overtime main shift column */}
          {showOvertimeColumn && isActive && (
            <div className={`flex flex-col items-center justify-center w-14 ${divider} gap-0.5 py-1`}>
              <button
                onClick={() => handleTimeClick('mainClockIn', mainClockIn)}
                className={`text-[10px] font-medium px-1 ${timeColor(mainClockIn)}`}
              >
                {formatTime(mainClockIn)}
              </button>
              <button
                onClick={() => handleTimeClick('mainClockOut', mainClockOut)}
                className={`text-[10px] font-medium px-1 ${timeColor(mainClockOut)}`}
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
                className={`flex-1 flex items-center justify-center ${divider} text-sm font-semibold ${timeColor(clockOut)} hover:bg-weekend/5 transition-colors`}
              >
                {formatTime(clockOut)}
              </button>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center text-xs text-muted-foreground ${divider}`}>
              Chạm để bật
            </div>
          )}

          {/* Notice cell */}
          {isActive ? (
            <button
              onClick={() => notice ? setExpandedNote(!expandedNote) : setExpandedNote(true)}
              className="w-20 flex items-center px-1.5 text-left hover:bg-muted/30 transition-colors"
            >
              {notice ? (
                <span className="text-[11px] text-foreground truncate w-full">{notice}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Ghi chú</span>
              )}
            </button>
          ) : (
            <div className="w-20" />
          )}
        </div>


        {/* Expanded note input */}
        <AnimatePresence>
          {expandedNote && isActive && (
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
                  placeholder="Nhập ghi chú..."
                  autoFocus
                  onBlur={() => setExpandedNote(false)}
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

