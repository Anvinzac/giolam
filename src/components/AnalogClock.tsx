import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { timeToString } from "@/lib/lunarUtils";

interface AnalogClockProps {
  onTimeSelect: (time: string) => void;
  onClose: () => void;
  label: string;
}

const AM_HOURS = Array.from({ length: 12 }, (_, i) => i); // 0-11
const PM_HOURS = Array.from({ length: 12 }, (_, i) => i + 12); // 12-23
const MINUTES = [0, 30];

function isDisabledHour(h: number): boolean {
  return (h >= 0 && h < 7) || h === 23;
}

export default function AnalogClock({ onTimeSelect, onClose, label }: AnalogClockProps) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [ring, setRing] = useState<'am' | 'pm'>('am');

  const hours = ring === 'am' ? AM_HOURS : PM_HOURS;

  const handleHourSelect = (h: number) => {
    if (isDisabledHour(h)) return;
    setSelectedHour(h);
  };

  const handleConfirm = () => {
    if (selectedHour === null) return;
    onTimeSelect(timeToString(selectedHour, selectedMinute));
    onClose();
  };

  const radius = 120;
  const innerRadius = 75;

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
          className="glass-card p-6 w-full max-w-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-foreground">{label}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setRing('am')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${ring === 'am' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                AM
              </button>
              <button
                onClick={() => setRing('pm')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${ring === 'pm' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Clock face */}
          <div className="relative mx-auto" style={{ width: radius * 2 + 40, height: radius * 2 + 40 }}>
            <svg width={radius * 2 + 40} height={radius * 2 + 40} className="mx-auto">
              {/* Outer ring */}
              <circle cx={radius + 20} cy={radius + 20} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
              {/* Inner ring */}
              <circle cx={radius + 20} cy={radius + 20} r={innerRadius} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />

              {hours.map((h, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const x = radius + 20 + Math.cos(angle) * radius;
                const y = radius + 20 + Math.sin(angle) * radius;
                const disabled = isDisabledHour(h);
                const selected = selectedHour === h;

                return (
                  <g key={h} onClick={() => handleHourSelect(h)} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
                    <circle
                      cx={x} cy={y} r={18}
                      fill={selected ? 'hsl(var(--primary))' : disabled ? 'hsl(var(--off-day))' : 'hsl(var(--secondary))'}
                      className="transition-colors"
                    />
                    <text
                      x={x} y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="12"
                      fontWeight={selected ? "600" : "400"}
                      fill={selected ? 'hsl(var(--primary-foreground))' : disabled ? 'hsl(var(--off-day-foreground))' : 'hsl(var(--foreground))'}
                    >
                      {h === 0 ? '12' : h > 12 ? h - 12 : h}
                    </text>
                  </g>
                );
              })}

              {/* Center display */}
              <text
                x={radius + 20} y={radius + 20}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="20"
                fontWeight="700"
                fontFamily="Space Grotesk"
                fill="hsl(var(--foreground))"
              >
                {selectedHour !== null ? `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}` : '--:--'}
              </text>
            </svg>
          </div>

          {/* Minutes */}
          <div className="flex gap-2 justify-center">
            {MINUTES.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMinute(m)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
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
            Confirm Time
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
