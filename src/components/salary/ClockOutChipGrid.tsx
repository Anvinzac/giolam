export interface ClockOutChipGridProps {
  baseTime: string;
  selectedTime: string | null;
  onSelect: (time: string) => void;
  onDayOff?: () => void;
  disabled: boolean;
  cardState?: 'focus' | 'review';
}

// Generate time options in 30-minute increments from +0.5h to +5h
function generateChipTimes(baseTime: string): string[] {
  const [hours, minutes] = baseTime.split(':').map(Number);
  const baseMinutes = hours * 60 + minutes;
  
  // Offsets in minutes: 30min to 300min (0.5h to 5h)
  const offsets = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
  
  return offsets.map(offset => {
    const totalMinutes = baseMinutes + offset;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  });
}

// Convert HH:MM to decimal hours for display (e.g., "17:30" -> "17.5")
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
  disabled,
  cardState = 'focus',
}: ClockOutChipGridProps) {
  const chipTimes = generateChipTimes(baseTime);
  const isReview = cardState === 'review';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, time: string) => {
    if (disabled) return;
    
    // Handle Enter and Space keys for selection
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(time);
    }
  };

  const handleDayOffKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || !onDayOff) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDayOff();
    }
  };

  return (
    <div 
      className="grid grid-cols-3 gap-2 sm:gap-3 w-full" 
      data-testid="clock-out-chip-grid"
      role="group"
      aria-label="Chọn giờ ra"
    >
      {chipTimes.map(time => {
        const isSelected = time === selectedTime;
        
        return (
          <button
            key={time}
            onClick={() => !disabled && onSelect(time)}
            onKeyDown={(e) => handleKeyDown(e, time)}
            disabled={disabled}
            aria-label={`Chọn giờ ra ${formatTimeDecimal(time)}`}
            aria-pressed={isSelected}
            className={`
              min-h-[44px] min-w-[44px] rounded-xl sm:rounded-2xl border-2 
              text-base sm:text-lg font-semibold
              transition-all duration-500
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
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
      
      {/* Day-off button */}
      {onDayOff && (
        <button
          onClick={() => !disabled && onDayOff()}
          onKeyDown={handleDayOffKeyDown}
          disabled={disabled}
          aria-label="Đánh dấu nghỉ"
          className={`
            min-h-[44px] min-w-[44px] rounded-xl sm:rounded-2xl border-2 
            text-base sm:text-lg font-semibold
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2
            border-destructive/60 bg-destructive/10 text-destructive 
            hover:border-destructive hover:bg-destructive/20 hover:scale-105
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          `}
        >
          Nghỉ
        </button>
      )}
    </div>
  );
}
