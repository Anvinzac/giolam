export interface ClockOutChipGridProps {
  baseTime: string;
  selectedTime: string | null;
  onSelect: (time: string) => void;
  onDayOff?: () => void;
  onCustom?: () => void;
  disabled: boolean;
  cardState?: 'focus' | 'review';
  isOffDay?: boolean;
  anchorTime?: string | null;
}

const DEFAULT_OFFSETS = [30, 60, 90, 120, 150, 180];

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(1439, mins));
  return `${Math.floor(clamped / 60).toString().padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`;
}

function generateChipTimes(baseTime: string, anchorTime?: string | null): string[] {
  const base = parseMinutes(baseTime);
  const defaultMax = base + DEFAULT_OFFSETS[DEFAULT_OFFSETS.length - 1];

  let shift = 0;
  if (anchorTime) {
    const anchor = parseMinutes(anchorTime);
    if (anchor > defaultMax) {
      shift = anchor - defaultMax;
    }
  }

  return DEFAULT_OFFSETS.map(o => minutesToTime(base + o + shift));
}

function formatTimeDecimal(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const decimal = hours + minutes / 60;
  return Number.isInteger(decimal) ? `${decimal}` : decimal.toFixed(1);
}

export default function ClockOutChipGrid({
  baseTime,
  selectedTime,
  onSelect,
  onDayOff,
  onCustom,
  disabled,
  cardState = 'focus',
  isOffDay = false,
  anchorTime,
}: ClockOutChipGridProps) {
  const chipTimes = generateChipTimes(baseTime, anchorTime);
  const isReview = cardState === 'review';

  const normalizedSelectedTime = selectedTime
    ? selectedTime.split(':').slice(0, 2).join(':')
    : null;

  // Check if selected time is a custom value (not in any chip)
  const isCustomValue = normalizedSelectedTime && !isOffDay && !chipTimes.includes(normalizedSelectedTime);

  return (
    <div
      className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full"
      data-testid="clock-out-chip-grid"
      role="group"
      aria-label="Chọn giờ ra"
    >
      {chipTimes.map(time => {
        const isSelected = !isOffDay && time === normalizedSelectedTime;
        return (
          <button
            key={time}
            onClick={() => !disabled && onSelect(time)}
            disabled={disabled}
            aria-label={`Chọn giờ ra ${formatTimeDecimal(time)}`}
            aria-pressed={isSelected}
            className={`
              h-10 sm:h-11 rounded-xl border-2
              text-sm sm:text-base font-semibold
              transition-all duration-500
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
              ${isSelected
                ? isReview
                  ? 'border-primary/40 bg-primary/20 text-foreground scale-105'
                  : 'border-primary bg-primary text-primary-foreground scale-105'
                : 'border-border/60 bg-muted/60 text-foreground hover:border-primary/60 hover:bg-primary/10 hover:scale-105'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
            `}
          >
            {formatTimeDecimal(time)}
          </button>
        );
      })}

      {/* "Khác" chip — opens celestial clock, shows custom value if set */}
      {onCustom && (
        <button
          onClick={() => !disabled && onCustom()}
          disabled={disabled}
          className={`
            h-10 sm:h-11 rounded-xl border-2
            text-sm sm:text-base font-semibold
            transition-all duration-500
            ${isCustomValue
              ? isReview
                ? 'border-primary/40 bg-primary/20 text-foreground scale-105'
                : 'border-primary bg-primary text-primary-foreground scale-105'
              : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-foreground'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          `}
        >
          {isCustomValue ? formatTimeDecimal(normalizedSelectedTime!) : 'Khác'}
        </button>
      )}

      {onDayOff && (
        <button
          onClick={() => !disabled && onDayOff()}
          disabled={disabled}
          aria-label="Đánh dấu nghỉ"
          aria-pressed={isOffDay}
          className={`
            h-10 sm:h-11 rounded-xl border-2
            text-sm sm:text-base font-semibold
            transition-all duration-500
            focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1
            ${isOffDay
              ? isReview
                ? 'border-destructive/40 bg-destructive/20 text-destructive scale-105'
                : 'border-destructive bg-destructive text-destructive-foreground scale-105'
              : 'border-destructive/60 bg-destructive/10 text-destructive hover:border-destructive hover:bg-destructive/20 hover:scale-105'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          `}
        >
          Nghỉ
        </button>
      )}
    </div>
  );
}
