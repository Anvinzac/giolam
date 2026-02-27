import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareText } from "lucide-react";
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
  const [autoClockPhase, setAutoClockPhase] = useState<'clockIn' | 'clockOut' | null>(null);
  const prevActiveRef = useRef(isActive);

  const hasDefaultTime = !!defaultClockIn && !!defaultClockOut;

  // When toggling from inactive→active without defaults, auto-open clock for clockIn
  useEffect(() => {
    if (isActive && !prevActiveRef.current && !hasDefaultTime && !isOffDay) {
      setAutoClockPhase('clockIn');
    }
    prevActiveRef.current = isActive;
  }, [isActive, hasDefaultTime, isOffDay]);

  // Show clock based on autoClockPhase
  useEffect(() => {
    if (autoClockPhase === 'clockIn') {
      setEditingTime({ field: 'clockIn', current: '08:00' });
    } else if (autoClockPhase === 'clockOut') {
      setEditingTime({ field: 'clockOut', current: '17:00' });
    }
  }, [autoClockPhase]);

  const dayIndex = (date.getDay() + 6) % 7;
  const isSaturday = dayIndex === 5;
  const isSunday = dayIndex === 6;
  const isWeekend = isSaturday || isSunday;
  const moonLabel = getMoonLabel(date);
  const isFullMoon = moonLabel === 'Full Moon';
  const isNewMoon = moonLabel === 'New Moon';
  const isMoonEve = moonLabel?.startsWith('Chay');

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
    const field = editingTime.field;
    switch (field) {
      case 'clockIn': onClockInChange(time); break;
      case 'clockOut': onClockOutChange(time); break;
      case 'mainClockIn': onMainClockInChange?.(time); break;
      case 'mainClockOut': onMainClockOutChange?.(time); break;
    }

    // If we're in auto-chain mode and just finished clockIn, move to clockOut
    if (autoClockPhase === 'clockIn' && field === 'clockIn') {
      setAutoClockPhase('clockOut');
      return; // Don't close - useEffect will open clockOut
    }

    // Done
    setAutoClockPhase(null);
    setEditingTime(null);
  };

  const handleClockClose = () => {
    setAutoClockPhase(null);
    setEditingTime(null);
  };

  const dateNum = date.getDate();
  const divider = "border-r border-border";
  const timeColor = (t: string | null) => isAM(t) ? 'text-success' : 'text-accent';

  const weekendBg = isSunday ? 'bg-sunday/10 border border-sunday/20' : 'bg-saturday/10 border border-saturday/20';
  const weekendText = isSunday ? 'text-sunday' : 'text-saturday';
  const weekendActiveBg = isSunday ? 'bg-sunday text-sunday-foreground' : 'bg-saturday text-saturday-foreground';

  const clockLabel = editingTime?.field.includes('In') ? 'Giờ vào' : 'Giờ ra';

  if (isOffDay) {
    return (
      <div className="flex items-stretch rounded-xl bg-off-day/50 opacity-60 overflow-hidden min-h-[40px]">
        <div className={`flex flex-col items-center justify-center w-16 py-1 ${divider}`}>
          <span className="text-xs font-medium text-off-day-foreground">{DAYS[dayIndex]}</span>
          <span className="text-[10px] text-off-day-foreground">{dateNum}</span>
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
        <div className="relative overflow-hidden">
          <div className={`flex items-stretch ${(notice || moonLabel) && !expandedNote ? 'min-h-[52px]' : 'min-h-[36px]'}`}>
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
            </button>

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

            <div className="flex-1 flex flex-col relative">
              {isActive ? (
                <div className="flex flex-1 items-center">
                  <button
                    onClick={() => handleTimeClick('clockIn', clockIn)}
                    className={`flex-1 flex items-center justify-center ${divider} text-sm font-semibold ${timeColor(clockIn)} hover:bg-success/5 transition-colors h-full`}
                  >
                    {formatTime(clockIn)}
                  </button>
                  <button
                    onClick={() => handleTimeClick('clockOut', clockOut)}
                    className={`flex-1 flex items-center justify-center text-sm font-semibold ${timeColor(clockOut)} hover:bg-accent/5 transition-colors h-full`}
                  >
                    {formatTime(clockOut)}
                  </button>
                </div>
              ) : (
              <button onClick={onToggle} className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground cursor-pointer">
                  Chạm ngày để bật
                </button>
              )}

              {(notice || moonLabel) && !expandedNote && (
                <div className="px-2 py-0.5 flex items-center justify-center gap-1">
                  {moonLabel && (
                    <span className={`text-xs font-medium shrink-0 ${
                      isFullMoon ? 'text-fullmoon' : isNewMoon ? 'text-newmoon' : 'text-primary'
                    }`}>{moonLabel}</span>
                  )}
                  {notice && moonLabel && <span className="text-muted-foreground/30 text-xs">·</span>}
                  {notice && (
                    <span className="text-xs text-muted-foreground truncate leading-tight">{notice}</span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setExpandedNote(!expandedNote)}
              className={`w-8 flex items-center justify-center rounded-r-xl ${divider} transition-colors ${
                notice ? 'text-primary' : 'text-muted-foreground'
              } hover:bg-muted/30`}
              title={isActive ? 'Ghi chú' : 'Lý do nghỉ'}
            >
              <MessageSquareText size={14} />
            </button>
          </div>
        </div>

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
          onClose={handleClockClose}
          label={clockLabel}
        />
      )}
      {editingTime && !hasDefaultTime && (
        <AnalogClock
          key={editingTime.field}
          onTimeSelect={handleTimeChange}
          onClose={handleClockClose}
          label={clockLabel}
        />
      )}
    </>
  );
}