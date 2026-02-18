import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { timeToString } from "@/lib/lunarUtils";

interface AnalogClockProps {
  onTimeSelect: (time: string) => void;
  onClose: () => void;
  label: string;
}

const MINUTES = [0, 30];

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

export default function AnalogClock({ onTimeSelect, onClose, label }: AnalogClockProps) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  const handleConfirm = () => {
    if (selectedHour === null) return;
    onTimeSelect(timeToString(selectedHour, selectedMinute));
    // Don't call onClose here - let the parent handle closing/chaining
  };

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;

  // Outer ring — bigger, more space
  const outerR = 155;
  const outerInnerR = 118;
  // Gap between rings
  // Inner ring
  const innerR = 108;
  const innerInnerR = 76;

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

  const formatDisplay = (h: number, m: number): string => {
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')}`;
  };

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

          <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-[280px] h-auto">
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
                  onClick={() => active && setSelectedHour(h24)}
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
                      fill={selected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))'}
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
                  onClick={() => active && setSelectedHour(h24)}
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
                      fontWeight={selected ? '700' : '500'}
                      fontFamily="Space Grotesk"
                      fill={selected ? 'hsl(var(--background))' : 'hsl(30, 50%, 30%)'}
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
            <text
              x={cx}
              y={selectedHour !== null ? cy - 8 : cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="26"
              fontWeight="700"
              fontFamily="Space Grotesk"
              fill="hsl(var(--foreground))"
            >
              {selectedHour !== null
                ? formatDisplay(selectedHour, selectedMinute)
                : '--:--'}
            </text>
            {periodLabel && (
              <text
                x={cx}
                y={cy + 16}
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
