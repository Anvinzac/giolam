import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { timeToString } from "@/lib/lunarUtils";

interface AnalogClockProps {
  onTimeSelect?: (time: string) => void;
  onTimeRangeSelect?: (times: { clockIn: string; clockOut: string }) => void;
  onClose: () => void;
  label: string;
  mode?: 'single' | 'range';
  initialClockIn?: string | null;
  initialClockOut?: string | null;
  initialActiveField?: 'in' | 'out';
}

// 12 clock positions in order: 12,1,2,...,11
const CLOCK_POSITIONS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Inner ring = AM: only 7-12 active
const AM_ACTIVE = new Set([7, 8, 9, 10, 11, 12]);
// Outer ring = PM: 1-10 active (13-22), 11(23) disabled, 12(noon) disabled (it's 12AM not PM)
const PM_DISABLED = new Set([11, 12]);

function clockPosToAM(pos: number): number {
  return pos; // 7->7, 8->8, ..., 12->12
}

function clockPosToPM(pos: number): number {
  if (pos === 12) return 0; // 12 on outer = midnight = 0, but disabled anyway
  return pos + 12; // 1->13, 2->14, ...11->23
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcSegmentPath(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.length > 5 ? time.slice(0, 5) : time;
}

function parseTime(time: string | null | undefined): { hour: number; minute: number } | null {
  const normalized = normalizeTime(time);
  if (!normalized) return null;
  const [hour, minute] = normalized.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

export default function AnalogClock({
  onTimeSelect,
  onTimeRangeSelect,
  onClose,
  label,
  mode = 'single',
  initialClockIn,
  initialClockOut,
  initialActiveField = 'in',
}: AnalogClockProps) {
  const isRangeMode = mode === 'range';
  const initialActiveTime = initialActiveField === 'in' ? initialClockIn : initialClockOut;
  const parsedInitialActiveTime = parseTime(initialActiveTime);
  const [selectedHour, setSelectedHour] = useState<number | null>(parsedInitialActiveTime?.hour ?? null);
  const [selectedMinute, setSelectedMinute] = useState<number>(parsedInitialActiveTime?.minute ?? 0);
  const [activeRangeField, setActiveRangeField] = useState<'in' | 'out' | null>(initialActiveField);
  const [rangeClockIn, setRangeClockIn] = useState<string | null>(normalizeTime(initialClockIn));
  const [rangeClockOut, setRangeClockOut] = useState<string | null>(normalizeTime(initialClockOut));
  // Bumps on every edit-within-active-field to restart the 3s advance timer
  // and re-trigger the progress-bar animation. Stays 0 until the user's
  // first tap, so the countdown never shows on load.
  const [progressTick, setProgressTick] = useState(0);
  // Whether auto-advance is still armed. The user opting to tap a range
  // button directly disables this permanently — they're taking control.
  const [autoAdvance, setAutoAdvance] = useState(true);

  // After 3s of inactivity on the active range field, advance: in -> out,
  // out -> null (both buttons unhighlighted, only "Xong" stays salient).
  // Only runs once the user has actually tapped the dial at least once
  // (progressTick > 0) AND auto-advance hasn't been disabled.
  useEffect(() => {
    if (!isRangeMode || activeRangeField === null) return;
    if (!autoAdvance || progressTick === 0) return;
    const t = setTimeout(() => {
      if (activeRangeField === 'in') {
        const parsedOut = parseTime(rangeClockOut);
        setActiveRangeField('out');
        setSelectedHour(parsedOut?.hour ?? null);
        if (parsedOut) setSelectedMinute(parsedOut.minute);
        setProgressTick(k => k + 1);
      } else {
        setActiveRangeField(null);
        setProgressTick(0);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [progressTick, activeRangeField, isRangeMode, rangeClockOut, autoAdvance]);

  const handleConfirm = () => {
    if (selectedHour === null) return;
    onTimeSelect?.(timeToString(selectedHour, selectedMinute));
    // Don't call onClose here - let the parent handle closing/chaining
  };

  const showRangeField = (field: 'in' | 'out') => {
    const nextTime = field === 'in' ? rangeClockIn : rangeClockOut;
    const parsed = parseTime(nextTime);
    setActiveRangeField(field);
    setSelectedHour(parsed?.hour ?? null);
    if (parsed) setSelectedMinute(parsed.minute);
    // User explicitly took control — no more auto-advance, no progress bar.
    setAutoAdvance(false);
    setProgressTick(0);
  };

  const recordRangeTime = (hour: number, minute: number) => {
    if (activeRangeField === null) return;
    const nextTime = timeToString(hour, minute);
    if (activeRangeField === 'in') setRangeClockIn(nextTime);
    else setRangeClockOut(nextTime);
    if (autoAdvance) setProgressTick(k => k + 1);
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    if (isRangeMode) {
      recordRangeTime(hour, selectedMinute);
    }
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    if (isRangeMode && selectedHour !== null) {
      recordRangeTime(selectedHour, minute);
    }
  };

  const handleRangeDone = () => {
    if (!rangeClockIn || !rangeClockOut) return;
    onTimeRangeSelect?.({ clockIn: rangeClockIn, clockOut: rangeClockOut });
  };

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;

  // Outer ring — widened now that the separate minute-picker row is gone,
  // so we recover the vertical space for a bigger dial.
  const outerR = 158;
  const outerInnerR = 120;
  // Inner ring — also grows; inner-inner shrinks to give the center more
  // room for the tappable minute toggle.
  const innerR = 114;
  const innerInnerR = 82;

  const gap = 1.5;
  const segAngle = 360 / 12;
  // Rotate CCW 15deg so numbers land at exact clock positions
  const rotateOffset = -15;

  const getPeriodLabel = (h: number | null): string | null => {
    if (h === null) return null;
    if (h >= 7 && h <= 10) return 'Sáng';
    if (h >= 11 && h <= 12) return 'Trưa';
    if (h >= 13 && h <= 17) return 'Chiều';
    if (h >= 18 && h <= 22) return 'Tối';
    return null;
  };

  const periodLabel = getPeriodLabel(selectedHour);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card p-5 w-full max-w-[360px] space-y-3"
        >
          <h3 className="font-display text-lg text-foreground text-center">{label}</h3>

          <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-[320px] h-auto">
            {/* Outer ring — PM */}
            {CLOCK_POSITIONS.map((pos, i) => {
              const startA = i * segAngle + gap / 2 + rotateOffset;
              const endA = (i + 1) * segAngle - gap / 2 + rotateOffset;
              const h24 = clockPosToPM(pos);
              const disabled = PM_DISABLED.has(pos);
              const active = !disabled;
              const selected = selectedHour === h24;
              // Label at the center of the segment arc
              const midAngle = (startA + endA) / 2;
              const labelR = (outerR + outerInnerR) / 2;
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

              return (
                <g
                  key={`pm-${pos}`}
                  onClick={() => active && handleHourSelect(h24)}
                  style={{ cursor: active ? 'pointer' : 'default' }}
                >
                  <path
                    d={arcSegmentPath(cx, cy, outerInnerR, outerR, startA, endA)}
                    fill={
                      selected
                        ? 'hsl(var(--primary))'
                        : disabled
                          ? 'hsl(var(--off-day))'
                          : 'hsl(var(--secondary))'
                    }
                    stroke="hsl(var(--background))"
                    strokeWidth="1.5"
                    className="transition-colors"
                    opacity={disabled ? 0.2 : 1}
                  />
                  {active && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="13"
                      fontWeight={selected ? '700' : '500'}
                      fontFamily="Space Grotesk"
                      fill={selected ? 'hsl(var(--primary-foreground))' : 'hsl(220, 20%, 85%)'}
                    >
                      {pos}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Inner ring — AM (warm yellow-ish shade) */}
            {CLOCK_POSITIONS.map((pos, i) => {
              const startA = i * segAngle + gap / 2 + rotateOffset;
              const endA = (i + 1) * segAngle - gap / 2 + rotateOffset;
              const h24 = clockPosToAM(pos);
              const active = AM_ACTIVE.has(pos);
              const selected = selectedHour === h24;
              const midAngle = (startA + endA) / 2;
              const labelR = (innerR + innerInnerR) / 2;
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

              return (
                <g
                  key={`am-${pos}`}
                  onClick={() => active && handleHourSelect(h24)}
                  style={{ cursor: active ? 'pointer' : 'default' }}
                >
                  <path
                    d={arcSegmentPath(cx, cy, innerInnerR, innerR, startA, endA)}
                    fill={
                      selected
                        ? 'hsl(45, 90%, 50%)'
                        : active
                          ? 'hsl(45, 40%, 75%)'
                          : 'hsl(var(--off-day))'
                    }
                    stroke="hsl(var(--background))"
                    strokeWidth="1.5"
                    className="transition-colors"
                    opacity={active ? 0.55 : 0.15}
                  />
                  {active && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="12"
                      fontWeight={selected ? '700' : '600'}
                      fontFamily="Space Grotesk"
                      fill={selected ? 'hsl(var(--background))' : 'hsl(0, 0%, 30%)'}
                    >
                      {pos}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Sun icon inside inner ring at 6 o'clock position */}
            {(() => {
              const sunAngle = 180; // 6 o'clock position
              const sunR = (innerInnerR + innerR) / 2; // center of inner ring
              const sunPos = polarToCartesian(cx, cy, sunR, sunAngle);
              return (
                <g transform={`translate(${sunPos.x}, ${sunPos.y})`}>
                  <circle r="7" fill="hsl(45, 95%, 60%)" opacity="0.3" />
                  <circle r="4" fill="hsl(45, 95%, 55%)" />
                  {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
                    const rad = (angle * Math.PI) / 180;
                    return (
                      <line
                        key={angle}
                        x1={Math.cos(rad) * 5}
                        y1={Math.sin(rad) * 5}
                        x2={Math.cos(rad) * 7.5}
                        y2={Math.sin(rad) * 7.5}
                        stroke="hsl(45, 95%, 55%)"
                        strokeWidth="1"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </g>
              );
            })()}

            {/* Center */}
            <circle cx={cx} cy={cy} r={innerInnerR - 4} fill="hsl(var(--background))" opacity={0.9} />
            {selectedHour === null ? (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="30"
                fontWeight="700"
                fontFamily="Space Grotesk"
                fill="hsl(var(--foreground))"
              >
                --:--
              </text>
            ) : (
              <>
                {(() => {
                  const h = selectedHour;
                  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                  const altMinute = selectedMinute === 0 ? 30 : 0;
                  const mainY = cy + 10;
                  const altY = cy - 26;
                  // Both ":" characters are rendered as the first char of
                  // a start-anchored ":mm" text at this exact x. The hour
                  // is end-anchored at the same x. Result: colons line up
                  // pixel-perfect across main + alt.
                  const colonX = cx - 10;
                  return (
                    <>
                      {/* Hour (end-anchored so its last char meets the colon). */}
                      <text
                        x={colonX}
                        y={mainY}
                        textAnchor="end"
                        dominantBaseline="central"
                        fontSize="30"
                        fontWeight="700"
                        fontFamily="Space Grotesk"
                        fill="hsl(var(--foreground))"
                      >
                        {h12}
                      </text>
                      {/* Current :mm (start-anchored at colonX). Tapping
                          it also swaps to the alternative minute. */}
                      <text
                        x={colonX}
                        y={mainY}
                        textAnchor="start"
                        dominantBaseline="central"
                        fontSize="30"
                        fontWeight="700"
                        fontFamily="Space Grotesk"
                        fill="hsl(var(--foreground))"
                        onClick={() => handleMinuteSelect(altMinute)}
                        style={{ cursor: 'pointer' }}
                      >
                        {`:${selectedMinute.toString().padStart(2, '0')}`}
                      </text>
                      {/* Alternative :mm — plain text at 50% opacity; also
                          tappable. Colon sits at the same colonX. */}
                      <text
                        x={colonX}
                        y={altY}
                        textAnchor="start"
                        dominantBaseline="central"
                        fontSize="30"
                        fontWeight="700"
                        fontFamily="Space Grotesk"
                        fill="hsl(var(--primary))"
                        opacity={0.5}
                        onClick={() => handleMinuteSelect(altMinute)}
                        style={{ cursor: 'pointer' }}
                      >
                        {`:${altMinute.toString().padStart(2, '0')}`}
                      </text>
                    </>
                  );
                })()}
              </>
            )}
            {periodLabel && (
              <text
                x={cx}
                y={cy + 36}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12"
                fontWeight="700"
                fill="hsl(var(--foreground))"
                fontFamily="Inter"
              >
                {periodLabel}
              </text>
            )}
          </svg>

          {isRangeMode ? (
            <div className="grid grid-cols-[1fr_1fr_0.9fr] gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => showRangeField('in')}
                className={`relative overflow-hidden py-3 rounded-xl font-display font-semibold text-xs transition-colors ${
                  activeRangeField === 'in'
                    ? 'gradient-gold text-primary-foreground'
                    : 'bg-muted text-emerald-400'
                }`}
              >
                {activeRangeField === 'in' && autoAdvance && progressTick > 0 && (
                  <motion.div
                    key={progressTick}
                    className="absolute inset-y-0 left-0 bg-white/25 pointer-events-none"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3, ease: 'linear' }}
                  />
                )}
                <span className="relative">Vào {rangeClockIn || '--:--'}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => showRangeField('out')}
                className={`relative overflow-hidden py-3 rounded-xl font-display font-semibold text-xs transition-colors ${
                  activeRangeField === 'out'
                    ? 'gradient-gold text-primary-foreground'
                    : 'bg-muted text-accent'
                }`}
              >
                {activeRangeField === 'out' && autoAdvance && progressTick > 0 && (
                  <motion.div
                    key={progressTick}
                    className="absolute inset-y-0 left-0 bg-white/25 pointer-events-none"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3, ease: 'linear' }}
                  />
                )}
                <span className="relative">Ra {rangeClockOut || '--:--'}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRangeDone}
                disabled={!rangeClockIn || !rangeClockOut}
                className="py-3 rounded-xl font-display font-semibold text-xs gradient-gold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Xong
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleConfirm}
              disabled={selectedHour === null}
              className="w-full py-3 rounded-xl font-display font-semibold text-sm gradient-gold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Xác nhận
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
