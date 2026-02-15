import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { timeToString } from "@/lib/lunarUtils";

interface AnalogClockProps {
  onTimeSelect: (time: string) => void;
  onClose: () => void;
  label: string;
}

const MINUTES = [0, 30];

// Inner ring: AM hours 7–12 (6 arcs)
const AM_HOURS = [7, 8, 9, 10, 11, 12]; // 12 means 0 (noon is PM)
// Outer ring: PM hours 1–12 (12=noon shown as 12, 1–10 active, 11–12 disabled)
const PM_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function isDisabledPM(h: number): boolean {
  return h === 11 || h === 12; // 23:xx and 12:xx(noon) — but 12 noon is ok... let me reconsider
  // Actually: outer ring PM: 1PM=13, 2PM=14... 10PM=22 ok, 11PM=23 disabled, 12PM=noon=12
  // User said closing at 10PM so 11PM(23) and after disabled
  // 12 on outer ring = noon = 12:00 — that should be fine
}

// Convert display hour to 24h
function amTo24(displayH: number): number {
  // AM ring: 7,8,9,10,11,12(midnight? no — 12AM doesn't exist here)
  // Actually 12 on AM ring = 0? No. Let's think:
  // Inner AM: 7=7, 8=8, 9=9, 10=10, 11=11, 12=12(noon)
  // Wait user said inner is AM 7-12. 12 in AM context is noon=12
  return displayH; // 7-12 stays 7-12
}

function pmTo24(displayH: number): number {
  // Outer PM: 1=13, 2=14...10=22, 11=23, 12=12(noon)
  if (displayH === 12) return 12; // noon
  return displayH + 12; // 1->13, 2->14, ...10->22, 11->23
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
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

  const handleConfirm = () => {
    if (selectedHour === null) return;
    onTimeSelect(timeToString(selectedHour, selectedMinute));
    onClose();
  };

  const size = 300;
  const cx = size / 2;
  const cy = size / 2;

  // Outer ring (PM): 12 segments
  const outerR = 140;
  const outerInnerR = 108;
  // Inner ring (AM): 6 segments
  const innerR = 104;
  const innerInnerR = 68;

  const gap = 2; // degrees gap between arcs

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

          {/* Clock face */}
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
            {/* Background circles */}
            <circle cx={cx} cy={cy} r={outerR + 2} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.3} />
            <circle cx={cx} cy={cy} r={outerInnerR} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.3} />
            <circle cx={cx} cy={cy} r={innerInnerR} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.3} />

            {/* Outer ring — PM hours (1-12) */}
            {PM_HOURS.map((h, i) => {
              const segAngle = 360 / 12;
              const startA = i * segAngle + gap / 2;
              const endA = (i + 1) * segAngle - gap / 2;
              const h24 = pmTo24(h);
              const disabled = h === 11; // 11PM = 23:00 disabled. 12=noon is fine.
              const selected = selectedHour === h24;
              const midAngle = (startA + endA) / 2;
              const labelR = (outerR + outerInnerR) / 2;
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

              return (
                <g
                  key={`pm-${h}`}
                  onClick={() => !disabled && setSelectedHour(h24)}
                  style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
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
                    opacity={disabled ? 0.4 : 1}
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11"
                    fontWeight={selected ? '700' : '500'}
                    fontFamily="Space Grotesk"
                    fill={
                      selected
                        ? 'hsl(var(--primary-foreground))'
                        : disabled
                          ? 'hsl(var(--off-day-foreground))'
                          : 'hsl(var(--muted-foreground))'
                    }
                  >
                    {h}h
                  </text>
                </g>
              );
            })}

            {/* Inner ring — AM hours (7-12) */}
            {AM_HOURS.map((h, i) => {
              const segAngle = 360 / 6;
              const startA = i * segAngle + gap / 2;
              const endA = (i + 1) * segAngle - gap / 2;
              const h24 = amTo24(h);
              const selected = selectedHour === h24;
              const midAngle = (startA + endA) / 2;
              const labelR = (innerR + innerInnerR) / 2;
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

              return (
                <g
                  key={`am-${h}`}
                  onClick={() => setSelectedHour(h24)}
                  style={{ cursor: 'pointer' }}
                >
                  <path
                    d={arcSegmentPath(cx, cy, innerInnerR, innerR, startA, endA)}
                    fill={selected ? 'hsl(var(--success))' : 'hsl(var(--muted))'}
                    stroke="hsl(var(--background))"
                    strokeWidth="1"
                    className="transition-colors"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="13"
                    fontWeight={selected ? '700' : '500'}
                    fontFamily="Space Grotesk"
                    fill={selected ? 'hsl(var(--success-foreground))' : 'hsl(var(--foreground))'}
                  >
                    {h}h
                  </text>
                </g>
              );
            })}

            {/* Center display */}
            <circle cx={cx} cy={cy} r={innerInnerR - 4} fill="hsl(var(--background))" opacity={0.8} />
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="22"
              fontWeight="700"
              fontFamily="Space Grotesk"
              fill="hsl(var(--foreground))"
            >
              {selectedHour !== null
                ? `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`
                : '--:--'}
            </text>
            {selectedHour !== null && (
              <text
                x={cx}
                y={cy + 14}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="10"
                fill="hsl(var(--muted-foreground))"
                fontFamily="Inter"
              >
                {selectedHour < 12 ? 'Sáng' : selectedHour < 18 ? 'Chiều' : 'Tối'}
              </text>
            )}

            {/* Ring labels */}
            <text x={cx} y={14} textAnchor="middle" fontSize="9" fill="hsl(var(--success))" fontWeight="600" fontFamily="Space Grotesk">SÁNG</text>
            <text x={cx} y={size - 6} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontWeight="600" fontFamily="Space Grotesk">CHIỀU / TỐI</text>
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
