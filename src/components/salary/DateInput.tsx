import { useState, useRef, useEffect } from 'react';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  periodStart: string; // YYYY-MM-DD for year inference
  periodEnd: string; // YYYY-MM-DD for year inference
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/**
 * Custom date input that shows DD/MM format and infers year from period
 */
export default function DateInput({
  value,
  onChange,
  min,
  max,
  periodStart,
  periodEnd,
  className = '',
  autoFocus = false,
  onBlur,
  onKeyDown,
}: DateInputProps) {
  // Convert YYYY-MM-DD to DD/MM
  const toDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    const [, month, day] = isoDate.split('-');
    return `${day}/${month}`;
  };

  // Convert DD/MM to YYYY-MM-DD, inferring year from period
  const toISO = (display: string): string => {
    const match = display.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return value; // Keep current if invalid

    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');

    // Infer year from period
    const periodStartYear = parseInt(periodStart.split('-')[0]);
    const periodEndYear = parseInt(periodEnd.split('-')[0]);
    const periodStartMonth = parseInt(periodStart.split('-')[1]);
    const periodEndMonth = parseInt(periodEnd.split('-')[1]);

    // If period spans two years (e.g., Dec 2026 - Jan 2027)
    if (periodEndYear > periodStartYear) {
      const inputMonth = parseInt(month);
      // If input month is in early months (Jan-Jun) and period starts in late months (Jul-Dec)
      if (inputMonth <= 6 && periodStartMonth >= 7) {
        return `${periodEndYear}-${month}-${day}`;
      }
      return `${periodStartYear}-${month}-${day}`;
    }

    // Same year period
    return `${periodStartYear}-${month}-${day}`;
  };

  const [displayValue, setDisplayValue] = useState(toDisplay(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(toDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits and /
    const cleaned = raw.replace(/[^\d/]/g, '');
    setDisplayValue(cleaned);
  };

  const handleBlur = () => {
    const isoDate = toISO(displayValue);
    
    // Validate against min/max
    if (min && isoDate < min) {
      setDisplayValue(toDisplay(min));
      onChange(min);
    } else if (max && isoDate > max) {
      setDisplayValue(toDisplay(max));
      onChange(max);
    } else {
      setDisplayValue(toDisplay(isoDate));
      onChange(isoDate);
    }
    
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    onKeyDown?.(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="DD/MM"
      className={className}
      autoFocus={autoFocus}
      inputMode="numeric"
    />
  );
}
