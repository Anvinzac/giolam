import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { timeToString } from "@/lib/lunarUtils";

interface AnalogClockProps {
  onTimeSelect: (time: string) => void;
  onClose: () => void;
  label: string;
}

const MINUTES = [0, 30];

// All 12 positions on a clock face (12,1,2,...,11)
const CLOCK_POSITIONS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Inner ring = AM: only 7-12 are active
const AM_ACTIVE = new Set([7, 8, 9, 10, 11, 12]);
// Outer ring = PM: 1PM(13)-10PM(22) active, 11PM(23) and 12PM(12 noon) — 12 on outer is noon
// Actually let's think: outer PM positions: 12=12(noon),1=13,2=14,...10=22,11=23
// Active: 12(noon)=12, 1-10 = 13-22. Disabled: 11=23
const PM_DISABLED = new Set([11]); // position 11 on outer = 23:00

function clockPosToAM(pos: number): number {
  return pos; // 12->12, 1->1, ... 11->11 — but only 7-12 interactive
}

function clockPosToPM(pos: number): number {
  if (pos === 12) return 12; // noon
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

export default function AnalogClock({ onTimeSelect, onClose, label }: AnalogClockProps) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  const handleHourSelect = (h24: number, ring: 'am' | 'pm') => {
    setSelectedHour(h24);
  };

  const handleConfirm = () => {
    if (selectedHour === null) return;
    onTimeSelect(timeToString(selectedHour, selectedMinute));
    onClose();
  };

  const size = 300;
  const cx = size / 2;
  const cy = size / 2;

  const outerR = 142;
  const outerInnerR = 110;
  const innerR = 106;
  const innerInnerR = 72;
  const gap = 1.5;
  const segAngle = 360 / 12;

  const periodLabel = selectedHour !== null
    ? (selectedHour < 12 ? 'Sáng' : selectedHour < 18 ? 'Chiều' : 'Tối')
    : null;

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
          className="glass-card p-5 w-full max-w-[340px] space-y-3"
        >
          <h3 className="font-display text-lg text-foreground text-center">{label}</h3>

          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
            {/* Outer ring — PM (12 segments at clock positions) */}
            {CLOCK_POSITIONS.map((pos, i) => {
              const startA = i * segAngle + gap / 2;
              const endA = (i + 1) * segAngle - gap / 2;
              const h24 = clockPosToPM(pos);
              const disabled = PM_DISABLED.has(pos);
              const active = !disabled;
              const selected = selectedHour === h24;
              const midAngle = (startA + endA) / 2;
              const labelR = (outerR + outerInnerR) / 2;
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

              return (
                <g
                  key={`pm-${pos}`}
                  onClick={() => active && handleHourSelect(h24, 'pm')}
                  style={{ cursor: active ? 'pointer' : 'not-allowed' }}
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
                    strokeWidth="1"
                    className="transition-colors"
                    opacity={disabled ? 0.3 : 1}
                  />
                  {active && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="10"
                      fontWeight={selected ? '700' : '400'}
                      fontFamily="Space Grotesk"
                      fill={selected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))'}
                    >
                      {pos}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Inner ring — AM (12 segments at clock positions, only 7-12 active) */}
            {CLOCK_POSITIONS.map((pos, i) => {
              const startA = i * segAngle + gap / 2;
              const endA = (i + 1) * segAngle - gap / 2;
              const h24 = clockPosToAM(pos);
              const active = AM_ACTIVE.has(pos);
              const selected = selectedHour === h24;
              const midAngle = (startA + endA) / 2;
              const labelR = (innerR + innerInnerR) / 2;
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

              return (
                <g
                  key={`am-${pos}`}
                  onClick={() => active && handleHourSelect(h24, 'am')}
                  style={{ cursor: active ? 'pointer' : 'default' }}
                >
                  <path
                    d={arcSegmentPath(cx, cy, innerInnerR, innerR, startA, endA)}
                    fill={
                      selected
                        ? 'hsl(var(--success))'
                        : active
                          ? 'hsl(var(--muted))'
                          : 'hsl(var(--off-day))'
                    }
                    stroke="hsl(var(--background))"
                    strokeWidth="1"
                    className="transition-colors"
                    opacity={active ? 1 : 0.2}
                  />
                  {active && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="12"
                      fontWeight={selected ? '700' : '500'}
                      fontFamily="Space Grotesk"
                      fill={selected ? 'hsl(var(--success-foreground))' : 'hsl(var(--foreground))'}
                    >
                      {pos}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Center display */}
            <circle cx={cx} cy={cy} r={innerInnerR - 4} fill="hsl(var(--background))" opacity={0.9} />
            <text
              x={cx}
              y={selectedHour !== null ? cy - 8 : cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="24"
              fontWeight="700"
              fontFamily="Space Grotesk"
              fill="hsl(var(--foreground))"
            >
              {selectedHour !== null
                ? `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`
                : '--:--'}
            </text>
            {periodLabel && (
              <text
                x={cx}
                y={cy + 14}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fontWeight="500"
                fill="hsl(var(--muted-foreground))"
                fontFamily="Inter"
              >
                {periodLabel}
              </text>
            )}
          </svg>

          {/* Minutes */}
          <div className="flex gap-2 justify-center">
            {MINUTES.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMinute(m)}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedMinute === m ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                :{m.toString().padStart(2, '0')}
              </button>
            ))}
          </div>

          {/* Confirm */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleConfirm}
            disabled={selectedHour === null}
            className="w-full py-3 rounded-xl font-display font-semibold text-sm gradient-gold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Xác nhận
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
