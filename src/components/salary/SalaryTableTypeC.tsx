import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, X, Clock } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcHoursFromTimes, getRateForDate, formatVND, formatDateViet } from '@/lib/salaryCalculations';
import { generateDateRange, splitIntoPages } from '@/lib/salaryPaging';
import SwipeablePages from './SwipeablePages';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';
import AnalogClock from '../AnalogClock';
import DateInput from './DateInput';

// Clock-in offsets: 6 chips in 30-minute increments
const CHIP_OFFSETS_CLOCK_IN_ALL = [-90, -60, -30, 0, 30, 60];

// Clock-out offsets: 6 chips in 30-minute increments
const CHIP_OFFSETS_ALL = [-120, -90, -60, -30, 0, 30];

const CHIP_CORE_START_INDEX_CLOCK_IN = 3; // Index of the 0 offset (center chip)
const CHIP_CORE_START_INDEX = 4; // Index of the 0 offset (center chip)
const CHIP_FADE_MASK =
  'linear-gradient(to right, transparent 0, black 28px, black calc(100% - 28px), transparent 100%)';

interface SalaryTableTypeCProps {
  entries: SalaryEntry[];
  rates: SpecialDayRate[];
  allowances: EmployeeAllowance[];
  offDays: string[];
  hourlyRate: number;
  periodStart: string;
  periodEnd: string;
  customStartDate: string | null;
  customEndDate: string | null;
  onEntryUpdate: (entryDate: string, sortOrder: number, updates: Partial<SalaryEntry>) => void;
  onEntryDateChange: (id: string, currentEntryDate: string, currentSortOrder: number, nextEntryDate: string) => void;
  onAddRowAtDate: (entryDate: string) => void;
  onAllowanceToggle: (key: AllowanceKey) => void;
  onAllowanceUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  onAddAllowance?: (label: string, amount: number) => void;
  onHourlyRateChange: (rate: number) => void;
  onCustomDateChange: (start: string | null, end: string | null) => void;
  defaultClockIn?: string | null;
  defaultClockOut?: string | null;
  onDefaultClockInChange?: (time: string) => void | Promise<void>;
  onDefaultClockOutChange?: (time: string) => void | Promise<void>;
  breakdown: SalaryBreakdown | null;
  isPreview?: boolean;
  editMode?: 'admin' | 'employee' | 'preview';
  onAcceptEntry?: (id: string) => void;
  onRemoveEntry?: (id: string) => void;
  currentUserId?: string | null;
  shiftType?: 'notice_only' | 'lunar_rate';
}

export default function SalaryTableTypeC({
  entries, rates, allowances, offDays, hourlyRate,
  periodStart, periodEnd, customStartDate, customEndDate,
  onEntryUpdate, onEntryDateChange, onAddRowAtDate, onAllowanceToggle, onAllowanceUpdate, onAddAllowance,
  onHourlyRateChange, onCustomDateChange, breakdown, isPreview = false,
  defaultClockIn: persistedDefaultClockIn,
  defaultClockOut: persistedDefaultClockOut,
  onDefaultClockInChange,
  onDefaultClockOutChange,
  editMode, onAcceptEntry, onRemoveEntry, currentUserId,
  shiftType = 'notice_only',
}: SalaryTableTypeCProps) {
  const mode: 'admin' | 'employee' | 'preview' =
    editMode ?? (isPreview ? 'preview' : 'admin');
  const readOnly = mode === 'preview';
  const canDeleteRow = (e: SalaryEntry) =>
    mode === 'admin' || (mode === 'employee' && e.is_admin_reviewed === false);
  const OFF_DAY_NOTE = 'Quán nghỉ';
  const [compact, setCompact] = useState(false);
  const [separateClockColumns, setSeparateClockColumns] = useState(true);
  // Track which clock field is showing chips: 'in' or 'out'
  const [chipRowKey, setChipRowKey] = useState<string | null>(null);
  const [chipClockType, setChipClockType] = useState<'in' | 'out'>('out');
  const [chipBaseByRowKey, setChipBaseByRowKey] = useState<Record<string, string>>({});
  const chipAutoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableGridClass = separateClockColumns 
    ? 'sm:grid-cols-[75px_minmax(170px,1fr)_74px_50px_40px_55px_55px_70px]'
    : 'sm:grid-cols-[75px_minmax(110px,1fr)_84px_40px_55px_55px_70px]';
  const tableGapClass = 'sm:gap-1.5 sm:px-2';
  const [currentPage, setCurrentPage] = useState(0);
  const [editingHourly, setEditingHourly] = useState(false);
  const [hourlyInput, setHourlyInput] = useState(hourlyRate.toString());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [pickingRange, setPickingRange] = useState<'start' | 'end' | null>(null);
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [addingDate, setAddingDate] = useState(false);
  const [newRowDate, setNewRowDate] = useState(periodStart);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [isChipAnimating, setIsChipAnimating] = useState(false);
  const [showClockIcon, setShowClockIcon] = useState<string | null>(null);
  const pendingDateTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTappedDateRef = useRef<string | null>(null);
  const clockIconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeClockDefault = (time: string | null | undefined, fallback: string) =>
    time ? (time.length > 5 ? time.slice(0, 5) : time) : fallback;
  const [defaultClockIn, setDefaultClockIn] = useState<string>(() =>
    normalizeClockDefault(persistedDefaultClockIn, '08:00')
  );
  const [defaultClockOut, setDefaultClockOut] = useState<string>(() =>
    normalizeClockDefault(persistedDefaultClockOut, '17:30')
  );
  const [pickingClock, setPickingClock] = useState<{
    scope: 'default' | 'cell';
    activeKind: 'in' | 'out';
    entryDate?: string;
    sortOrder?: number;
    clockIn?: string | null;
    clockOut?: string | null;
  } | null>(null);

  const effectiveStart = customStartDate || periodStart;
  const effectiveEnd = customEndDate || periodEnd;

  useEffect(() => {
    setNewRowDate(effectiveEnd >= periodStart ? effectiveStart : periodStart);
  }, [effectiveStart, effectiveEnd, periodStart]);

  useEffect(() => {
    setDefaultClockIn(normalizeClockDefault(persistedDefaultClockIn, '08:00'));
  }, [persistedDefaultClockIn]);

  useEffect(() => {
    setDefaultClockOut(normalizeClockDefault(persistedDefaultClockOut, '17:30'));
  }, [persistedDefaultClockOut]);

  useEffect(() => {
    return () => {
      if (pendingDateTapRef.current) clearTimeout(pendingDateTapRef.current);
      if (chipAutoHideTimerRef.current) clearTimeout(chipAutoHideTimerRef.current);
      if (clockIconTimerRef.current) clearTimeout(clockIconTimerRef.current);
    };
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => e.entry_date >= effectiveStart && e.entry_date <= effectiveEnd);
  }, [entries, effectiveStart, effectiveEnd]);
  const scheduledOffDays = useMemo(
    () => new Set(offDays.filter(date => date >= effectiveStart && date <= effectiveEnd)),
    [offDays, effectiveStart, effectiveEnd]
  );

  const pages = useMemo(() =>
    splitIntoPages(effectiveStart, effectiveEnd, filteredEntries),
    [effectiveStart, effectiveEnd, filteredEntries]
  );

  const workingEntries = useMemo(() =>
    filteredEntries.filter(e => !e.is_day_off && (e.clock_in || e.clock_out)),
    [filteredEntries]
  );

  const guiXeSummary = useMemo(() => {
    const fromBreakdown = breakdown?.allowances?.find(a => a.key === 'gui_xe');
    const workingDays = entries.reduce((sum, e) => sum + (!e.is_day_off && (e.clock_in || e.clock_out) ? 1 : 0), 0);
    const computedAmount = workingDays * 10000;
    return {
      amount: fromBreakdown?.amount ?? computedAmount,
      enabled: fromBreakdown?.enabled ?? (allowances.find(a => a.allowance_key === 'gui_xe')?.is_enabled ?? false),
    };
  }, [breakdown, entries, allowances]);

  useEffect(() => {
    scheduledOffDays.forEach((dateStr) => {
      const existingEntry = filteredEntries.find(e => e.entry_date === dateStr && e.sort_order === 0)
        || filteredEntries.find(e => e.entry_date === dateStr);
      if (existingEntry) {
        if (!existingEntry.is_day_off || existingEntry.note !== OFF_DAY_NOTE || existingEntry.clock_in || existingEntry.clock_out || existingEntry.total_hours !== null) {
          onEntryUpdate(dateStr, existingEntry.sort_order, {
            is_day_off: true,
            note: OFF_DAY_NOTE,
            clock_in: null,
            clock_out: null,
            total_hours: null,
          });
        }
        return;
      }

      onEntryUpdate(dateStr, 0, {
        is_day_off: true,
        note: OFF_DAY_NOTE,
        clock_in: null,
        clock_out: null,
        total_hours: null,
      });
    });
  }, [scheduledOffDays, filteredEntries, onEntryUpdate]);

  const getDayColor = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    if (day === 6) return 'text-saturday';
    if (day === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
  };

  const computeRow = (e: SalaryEntry) => {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
    const baseWage = roundToThousand(hours * hourlyRate);
    const allowanceAmt = roundToThousand(baseWage * rate / 100);
    const total = e.is_day_off ? 0 : baseWage + allowanceAmt;
    return { rate, hours, baseWage, allowanceAmt, total };
  };

  const formatHours = (hours: number) => {
    if (hours <= 0) return '—';
    return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  };

  const formatClockDecimal = (time: string | null) => {
    if (!time) return '—';
    const [hoursStr, minutesStr] = time.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return '—';
    const decimalHours = hours + minutes / 60;
    return Number.isInteger(decimalHours) ? `${decimalHours}` : decimalHours.toFixed(1);
  };

  const formatDayOnly = (dateStr: string) => dateStr.slice(8, 10);

  const formatVietnameseDay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const dayNumber = date.getDate();
    
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const formattedDay = dayNumber < 10 ? `0${dayNumber}` : `${dayNumber}`;
    return `${dayNames[dayOfWeek]} ${formattedDay}`;
  };

  const parseTimeToMinutes = (time: string) => {
    const [h, m] = time.split(':');
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
  };

  const formatMinutesToTime = (minutes: number) => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
    const hh = `${Math.floor(clamped / 60)}`.padStart(2, '0');
    const mm = `${clamped % 60}`.padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const addMinutes = (time: string, deltaMinutes: number) => {
    const base = parseTimeToMinutes(time);
    if (base === null) return time;
    return formatMinutesToTime(base + deltaMinutes);
  };

  const ensureChipBase = (rowKey: string, fallback: string) => {
    setChipBaseByRowKey(prev => (prev[rowKey] ? prev : { ...prev, [rowKey]: fallback }));
  };

  const startChipAutoHide = (rowKey: string) => {
    if (chipAutoHideTimerRef.current) clearTimeout(chipAutoHideTimerRef.current);
    chipAutoHideTimerRef.current = setTimeout(() => {
      setChipRowKey((current) => (current === rowKey ? null : current));
    }, 3000);
  };

  const showRowChips = (rowKey: string, baseTime: string, clockType: 'in' | 'out') => {
    // Always update the base time for this row when showing chips
    setChipBaseByRowKey(prev => ({ ...prev, [rowKey]: baseTime }));
    setChipRowKey(rowKey);
    setChipClockType(clockType);
    startChipAutoHide(rowKey);
  };

  useEffect(() => {
    // If user turns off split mode, chips should disappear immediately.
    if (!separateClockColumns && chipRowKey) setChipRowKey(null);
  }, [separateClockColumns, chipRowKey]);

  // Scroll-align the active chip row so the first "core" chip sits at the
  // left edge — extras to its left stay hidden behind the fade mask and are
  // revealed by scrolling back.
  const activeChipScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!chipRowKey) return;
    const raf = requestAnimationFrame(() => {
      const el = activeChipScrollRef.current;
      if (!el) return;
      const core = el.querySelector<HTMLElement>('[data-chip-core-start="true"]');
      if (core) el.scrollLeft = core.offsetLeft - el.offsetLeft;
    });
    return () => cancelAnimationFrame(raf);
  }, [chipRowKey]);

  const saveHourlyRate = () => {
    onHourlyRateChange(parseInt(hourlyInput) || 25000);
    setEditingHourly(false);
  };

  const startCellEdit = (key: string, val: string) => {
    setEditingCell(key);
    setCellValue(val);
  };

  const openCellClockPicker = (entryDate: string, sortOrder: number, kind: 'in' | 'out', currentValue?: string | null) => {
    const row = filteredEntries.find(entry => entry.entry_date === entryDate && entry.sort_order === sortOrder);
    setEditingCell(`${entryDate}-${sortOrder}-clock_${kind}`);
    setCellValue(currentValue || '');
    setPickingClock({
      scope: 'cell',
      activeKind: kind,
      entryDate,
      sortOrder,
      clockIn: row?.clock_in || defaultClockIn,
      clockOut: row?.clock_out || defaultClockOut,
    });
  };

  const startDateEdit = (key: string, val: string) => {
    setEditingDateKey(key);
    setEditingDateValue(val);
  };

  const saveDateEdit = (e: SalaryEntry) => {
    if (!e.id) {
      setEditingDateKey(null);
      return;
    }
    const nextDate = editingDateValue || e.entry_date;
    onEntryDateChange(e.id, e.entry_date, e.sort_order, nextDate);
    setEditingDateKey(null);
  };

  const formatNextDay = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const clampDateToPeriod = (dateStr: string) => {
    if (!dateStr) return periodStart;
    if (dateStr < periodStart) return periodStart;
    if (dateStr > periodEnd) return periodEnd;
    return dateStr;
  };

  const queueDateTapAction = (e: SalaryEntry, cellKey: string) => {
    if (readOnly) return;
    if (pendingDateTapRef.current && lastTappedDateRef.current === cellKey) {
      clearTimeout(pendingDateTapRef.current);
      pendingDateTapRef.current = null;
      lastTappedDateRef.current = null;
      onAddRowAtDate(formatNextDay(e.entry_date));
      return;
    }

    lastTappedDateRef.current = cellKey;
    pendingDateTapRef.current = setTimeout(() => {
      startDateEdit(`${cellKey}-date`, e.entry_date);
      pendingDateTapRef.current = null;
      lastTappedDateRef.current = null;
    }, 220);
  };

  const saveCellEdit = (entryDate: string, sortOrder: number, field: string, overrideValue?: string) => {
    const nextValue = overrideValue ?? cellValue;
    const updates: Partial<SalaryEntry> = {};
    if (field === 'clock_in') updates.clock_in = nextValue || null;
    if (field === 'clock_out') updates.clock_out = nextValue || null;
    if (field === 'note') updates.note = nextValue || null;
    onEntryUpdate(entryDate, sortOrder, updates);
    setEditingCell(null);
  };

  const toggleDayOff = (e: SalaryEntry) => {
    const rowKey = `${e.entry_date}-${e.sort_order}`;
    if (chipRowKey === rowKey) {
      setChipRowKey(null);
    }
    
    // If activating a row (turning day off -> on), show clock icon
    if (e.is_day_off) {
      setShowClockIcon(rowKey);
    }
    
    onEntryUpdate(e.entry_date, e.sort_order, {
      is_day_off: !e.is_day_off,
      ...(e.is_day_off
        ? {
            clock_in: defaultClockIn,
            clock_out: defaultClockOut,
            total_hours: calcHoursFromTimes(defaultClockIn, defaultClockOut),
          }
        : { clock_in: null, clock_out: null, total_hours: null }),
    });
  };

  const activateEmptyDay = (dateStr: string) => {
    if (scheduledOffDays.has(dateStr)) return;
    const totalHours = calcHoursFromTimes(defaultClockIn, defaultClockOut);
    const rowKey = `${dateStr}-0`;
    
    // Show clock icon when activating
    setShowClockIcon(rowKey);
    
    onEntryUpdate(dateStr, 0, {
      is_day_off: false,
      clock_in: defaultClockIn,
      clock_out: defaultClockOut,
      total_hours: totalHours,
      note: null,
    });
  };

  const renderRow = (e: SalaryEntry, idx?: number, allEntries?: SalaryEntry[]) => {
    const { rate, hours, baseWage, allowanceAmt, total } = computeRow(e);
    const matchedRate = rates.find(r => r.special_date === e.entry_date);
    
    // For Type D (lunar_rate), only show notice for New Moon and Full Moon
    let rateDesc = matchedRate?.description_vi;
    if (shiftType === 'lunar_rate') {
      if (matchedRate?.day_type === 'new_moon') {
        rateDesc = 'Mùng 1 - 35k';
      } else if (matchedRate?.day_type === 'full_moon') {
        rateDesc = 'Rằm - 35k';
      } else {
        rateDesc = undefined; // No notice for other days
      }
    }
    
    const cellKey = `${e.entry_date}-${e.sort_order}`;
    const isScheduledOffDay = scheduledOffDays.has(e.entry_date);
    const isMoonDay = matchedRate?.day_type === 'new_moon' || matchedRate?.day_type === 'full_moon';
    const canEditClock = !readOnly && !e.is_day_off && !isScheduledOffDay;
    const showClockChips = canEditClock && chipRowKey === cellKey;

    // Show week separator after Sunday, if not the last row
    const isSunday = new Date(e.entry_date + 'T00:00:00').getDay() === 0;
    const entries = allEntries || [];
    const nextEntry = idx !== undefined ? entries[idx + 1] : undefined;
    const showWeekSep = isSunday && nextEntry !== undefined;
    const toggleClockInChips = () => {
      if (!canEditClock) return;
      // If this row's chips are showing and it's already clock-in, hide them
      if (chipRowKey === cellKey && chipClockType === 'in') {
        setChipRowKey(null);
        return;
      }
      // Otherwise show clock-in chips (even if clock-out chips were showing)
      showRowChips(cellKey, e.clock_in || defaultClockIn, 'in');
    };
    const toggleClockOutChips = () => {
      if (!canEditClock) return;
      // If this row's chips are showing and it's already clock-out, hide them
      if (chipRowKey === cellKey && chipClockType === 'out') {
        setChipRowKey(null);
        return;
      }
      // Otherwise show clock-out chips (even if clock-in chips were showing)
      showRowChips(cellKey, e.clock_out || defaultClockOut, 'out');
    };
    const renderClockChips = (className = '') => {
      const isClockIn = chipClockType === 'in';
      const base = chipBaseByRowKey[cellKey] || (isClockIn ? (e.clock_in || defaultClockIn) : (e.clock_out || defaultClockOut));
      const offsets = isClockIn ? CHIP_OFFSETS_CLOCK_IN_ALL : CHIP_OFFSETS_ALL;
      const coreStartIndex = isClockIn ? CHIP_CORE_START_INDEX_CLOCK_IN : CHIP_CORE_START_INDEX;
      const allCandidates = offsets.map((o) => addMinutes(base, o));
      
      // Accent colors based on origin
      const accentColor = isClockIn ? 'orange-400' : 'accent';
      const accentBorder = isClockIn ? 'border-orange-400' : 'border-accent';
      const accentBg = isClockIn ? 'bg-orange-400' : 'bg-accent';
      const accentBgLight = isClockIn ? 'bg-orange-400/15' : 'bg-accent/15';
      const accentText = isClockIn ? 'text-orange-400' : 'text-accent';
      const accentHoverBorder = isClockIn ? 'hover:border-orange-400/60' : 'hover:border-accent/60';
      const accentHoverBg = isClockIn ? 'hover:bg-orange-400/10' : 'hover:bg-accent/10';
      
      // Filter candidates based on constraints
      const candidates = allCandidates.filter((timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        const totalMinutes = h * 60 + m;
        
        // Only allow times that are multiples of 30 minutes (0.5 hour increments)
        if (m !== 0 && m !== 30) return false;
        
        if (isClockIn) {
          // Clock-in: must be >= 7:30 AM (450 min) and <= 8:00 PM (1200 min)
          return totalMinutes >= 450 && totalMinutes <= 1200;
        } else {
          // Clock-out: must be >= clock-in time and <= 11:00 PM (1380 min)
          const clockInTime = e.clock_in || defaultClockIn;
          const [inH, inM] = clockInTime.split(':').map(Number);
          const clockInMinutes = inH * 60 + inM;
          return totalMinutes >= clockInMinutes && totalMinutes <= 1380;
        }
      });
      
      const selected = isClockIn ? (e.clock_in || base) : (e.clock_out || base);
      const otherClock = isClockIn ? (e.clock_out || defaultClockOut) : (e.clock_in || defaultClockIn);

      return (
        <div
          className={`relative min-w-0 ${className}`}
          style={{ maskImage: CHIP_FADE_MASK, WebkitMaskImage: CHIP_FADE_MASK }}
          onPointerDown={() => startChipAutoHide(cellKey)}
        >
          <div
            ref={activeChipScrollRef}
            className="flex items-center justify-end gap-1.5 min-w-0 overflow-x-auto whitespace-nowrap py-0.5 pl-1 pr-2 no-scrollbar [&_button]:focus:outline-none [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-0 [&_button]:focus-visible:ring-offset-0"
          >
            {/* "Khác" chip - opens analog clock */}
            <motion.button
              type="button"
              initial={false}
              onClick={() => {
                if (!canEditClock) return;
                // Open analog clock picker
                openCellClockPicker(e.entry_date, e.sort_order, isClockIn ? 'in' : 'out', isClockIn ? e.clock_in : e.clock_out);
                setChipRowKey(null); // Hide chips when opening clock
              }}
              className={`inline-flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-[12px] font-semibold text-foreground ${accentHoverBorder} ${accentHoverBg} transition-colors outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0`}
              aria-label="Chọn giờ khác"
            >
              Khác
            </motion.button>
            {candidates.map((t, i) => {
              const isSelected = selected === t;
              const isHighlighted = selectedChip === t;
              const originalIndex = allCandidates.indexOf(t);
              return (
                <motion.button
                  key={`${t}-${i}`}
                  type="button"
                  data-chip-core-start={originalIndex === coreStartIndex ? 'true' : undefined}
                  initial={false}
                  animate={{
                    opacity: isChipAnimating && !isHighlighted ? 0.3 : 1,
                    scale: isHighlighted ? 1.1 : 1
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  onClick={async () => {
                    if (!canEditClock || isChipAnimating) return;
                    
                    // Step 1: Highlight the selected chip
                    setSelectedChip(t);
                    setIsChipAnimating(true);
                    
                    // Step 2: Wait for highlight animation
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    // Step 3: Update the data
                    if (isClockIn) {
                      onEntryUpdate(e.entry_date, e.sort_order, {
                        clock_in: t,
                        clock_out: otherClock,
                        total_hours: calcHoursFromTimes(t, otherClock),
                      });
                    } else {
                      onEntryUpdate(e.entry_date, e.sort_order, {
                        clock_in: otherClock,
                        clock_out: t,
                        total_hours: calcHoursFromTimes(otherClock, t),
                      });
                    }
                    
                    // Step 4: Fade out chips and hide
                    await new Promise(resolve => setTimeout(resolve, 150));
                    setChipRowKey(null);
                    
                    // Step 5: Reset animation state
                    setTimeout(() => {
                      setSelectedChip(null);
                      setIsChipAnimating(false);
                    }, 300);
                  }}
                  className={`inline-flex shrink-0 items-center justify-center rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-all duration-200 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                    isHighlighted
                      ? `${accentBorder} ${accentBg} text-white shadow-lg`
                      : isSelected
                      ? `${accentBorder}/60 ${accentBgLight} ${accentText}`
                      : `border-transparent bg-muted/60 text-foreground ${accentHoverBorder} ${accentHoverBg}`
                  }`}
                  aria-label={`Đặt giờ ${isClockIn ? 'vào' : 'ra'}: ${t}`}
                >
                  {formatClockDecimal(t)}
                </motion.button>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div key={cellKey}>
      <div
        className={`relative overflow-hidden py-2.5 px-0 text-[13px] border-b border-border/20 w-full sm:hidden ${
          e.is_day_off || isScheduledOffDay ? 'opacity-50 cursor-pointer hover:opacity-70' : ''
        } ${idx && idx % 2 !== 0 ? 'bg-muted/40' : ''} ${
          isMoonDay ? 'moon-accent-row' : ''
        } ${showWeekSep ? 'relative' : ''}`}
        onClick={(ev) => {
          // Only activate if row is deactivated and not in readOnly mode
          if (!readOnly && e.is_day_off && !isScheduledOffDay) {
            // Check if click is on the toggle button or input
            const target = ev.target as HTMLElement;
            const isToggleButton = target.closest('[data-toggle-button]');
            const isInput = target.closest('input');
            if (!isToggleButton && !isInput) {
              toggleDayOff(e);
            }
          }
        }}
      >
        {!readOnly && !e.is_day_off && !isScheduledOffDay && !showClockChips && (
          <button
            data-toggle-button
            type="button"
            aria-label="Tắt ngày"
            onClick={(ev) => { ev.stopPropagation(); toggleDayOff(e); }}
            className="absolute top-0 left-0 w-[15%] h-full z-10 bg-transparent"
          />
        )}
        <AnimatePresence initial={false} mode="popLayout">
        {showClockChips ? (
          <motion.div
            key="chips"
            initial={{ y: '180%' }}
            animate={{ y: 0 }}
            exit={{ y: '-180%' }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="w-full min-h-[38px] flex items-center"
          >
            {renderClockChips('w-full')}
          </motion.div>
        ) : (
          <motion.div
            key="body"
            initial={{ y: '180%' }}
            animate={{ y: 0 }}
            exit={{ y: '-180%' }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start justify-between gap-2 w-full pl-3 pr-3"
          >
        <div className="min-w-0 flex-1 pr-1 flex flex-col justify-between min-h-[38px]">
          <div className="flex items-start gap-1.5">
            {!readOnly && (
              <button data-toggle-button onClick={() => toggleDayOff(e)} className={`mt-0.5 flex-shrink-0 transition-colors ${e.is_day_off ? 'text-destructive/60 hover:text-destructive' : 'text-emerald-400/60 hover:text-emerald-400'}`}>
                {e.is_day_off ? <X size={11} /> : <Check size={11} />}
              </button>
            )}
            {editingDateKey === `${cellKey}-date` && !readOnly ? (
              <DateInput
                value={editingDateValue}
                onChange={setEditingDateValue}
                min={periodStart}
                max={periodEnd}
                periodStart={periodStart}
                periodEnd={periodEnd}
                onBlur={() => saveDateEdit(e)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') saveDateEdit(e);
                  if (ev.key === 'Escape') setEditingDateKey(null);
                }}
                className="px-1 py-1 rounded bg-background border border-border text-[10px] min-w-0 w-full"
                autoFocus
              />
            ) : (
              <button
                onClick={() => toggleDayOff(e)}
                className={`block -mt-0.5 leading-none whitespace-nowrap ${getDayColor(e.entry_date)} ${!readOnly ? 'hover:underline' : 'cursor-default'}`}
              >
                <span className="font-light text-[11px] opacity-50 mr-1.5">{formatVietnameseDay(e.entry_date).split(' ')[0]}</span>
                <span className="font-semibold text-[17px]">{formatVietnameseDay(e.entry_date).split(' ')[1]}</span>
              </button>
            )}
          </div>
          {editingCell === `${cellKey}-note` && !readOnly && !e.is_day_off && !isScheduledOffDay ? (
            <input value={cellValue} onChange={ev => setCellValue(ev.target.value)}
              onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
              className="px-2 py-1 rounded bg-background border border-border text-[12px] min-w-0 w-full" autoFocus />
          ) : (
            <button 
              onClick={() => !readOnly && !e.is_day_off && !isScheduledOffDay && e.note && startCellEdit(`${cellKey}-note`, e.note || '')}
              className={`block text-left text-[12px] leading-tight ${
                isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
              } ${!readOnly && !e.is_day_off && !isScheduledOffDay && e.note ? 'hover:text-foreground transition-colors cursor-pointer' : 'cursor-default'}`}>
              {e.note || (isScheduledOffDay ? OFF_DAY_NOTE : rateDesc) || '—'}
            </button>
          )}
        </div>
        <div className="ml-1 flex shrink-0 items-center gap-2 text-right">
          {separateClockColumns ? (
            <>
              {/* Clock icon - stays visible with 30% opacity */}
              <AnimatePresence>
                {showClockIcon === cellKey && !readOnly && !e.is_day_off && !isScheduledOffDay && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.3, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => {
                      openCellClockPicker(e.entry_date, e.sort_order, 'in', e.clock_in);
                      setShowClockIcon(null);
                    }}
                    className="flex items-center justify-center w-[24px] h-[24px] rounded-full bg-accent/20 text-accent hover:bg-accent/30 hover:opacity-100 transition-all"
                  >
                    <Clock size={14} />
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="flex w-[40px] min-h-[38px] items-center justify-center">
                <button
                  onClick={toggleClockInChips}
                  className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-orange-400 hover:underline' : 'text-orange-400 cursor-default'}`}>
                  {formatClockDecimal(e.clock_in)}
                </button>
              </div>
              <div className="flex w-[40px] min-h-[38px] items-center justify-center">
                <button onClick={toggleClockOutChips}
                  className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-accent hover:underline' : 'text-accent cursor-default'}`}>
                  {formatClockDecimal(e.clock_out)}
                </button>
              </div>
            </>
          ) : (
            <div className="flex w-[40px] flex-col gap-[0.15rem] min-h-[38px] items-center justify-center">
              {editingCell === `${cellKey}-clock_in` && !readOnly && !e.is_day_off && !isScheduledOffDay ? (
                <button
                  onClick={toggleClockInChips}
                  className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-orange-400"
                >
                  Chọn
                </button>
              ) : (
                <button type="button"
                  onClick={toggleClockInChips}
                  className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-orange-400 hover:underline' : 'text-orange-400 cursor-default'}`}>
                  {formatClockDecimal(e.clock_in)}
                </button>
              )}
              {editingCell === `${cellKey}-clock_out` && !readOnly && !e.is_day_off && !isScheduledOffDay ? (
                <button
                  onClick={toggleClockOutChips}
                  className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-accent"
                >
                  Chọn
                </button>
              ) : (
                <button onClick={toggleClockOutChips}
                  className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-accent hover:underline' : 'text-accent cursor-default'}`}>
                  {formatClockDecimal(e.clock_out)}
                </button>
              )}
            </div>
          )}
          <span className="num-cell w-[24px] text-right font-semibold text-[13px]">{formatHours(hours)}</span>
          <span className="num-cell w-[34px] text-right font-medium text-[13px] text-foreground/70">
            {baseWage > 0 ? (baseWage / 1000).toFixed(0) : '—'}
          </span>
          <span className="num-cell w-[30px] text-right allowance-amt font-semibold text-[13px]">
            {allowanceAmt > 0 ? (allowanceAmt / 1000).toFixed(0) : ''}
          </span>
          <span className="num-cell-lg w-[40px] text-right font-bold text-[14px]">{total > 0 ? (total / 1000).toFixed(0) : '—'}</span>
        </div>
        {showWeekSep && (
          <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full week-separator" />
        )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      <div 
        className={`relative hidden sm:grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[13px] sm:text-[14px] border-b border-border/20 w-full ${
          e.is_day_off || isScheduledOffDay ? 'opacity-50 cursor-pointer hover:opacity-70' : ''
        } ${idx && idx % 2 !== 0 ? 'bg-muted/40' : ''} ${
          isMoonDay ? 'moon-accent-row' : ''
        }`}
        onClick={(ev) => {
          // Only activate if row is deactivated and not in readOnly mode
          if (!readOnly && e.is_day_off && !isScheduledOffDay) {
            // Check if click is on the toggle button or input
            const target = ev.target as HTMLElement;
            const isToggleButton = target.closest('[data-toggle-button]');
            const isInput = target.closest('input');
            if (!isToggleButton && !isInput) {
              toggleDayOff(e);
            }
          }
        }}
      >
        {!readOnly && !e.is_day_off && !isScheduledOffDay && (
          <button
            data-toggle-button
            type="button"
            aria-label="Tắt ngày"
            onClick={(ev) => { ev.stopPropagation(); toggleDayOff(e); }}
            className="absolute top-0 left-0 w-[15%] h-full z-10 bg-transparent"
          />
        )}
        {/* Date + note */}
        <div className="pr-4 sm:pr-2">
          <div className="flex items-start gap-1.5">
            {!readOnly && (
              <button data-toggle-button onClick={() => toggleDayOff(e)} className={`mt-0.5 flex-shrink-0 transition-colors ${e.is_day_off ? 'text-destructive/60 hover:text-destructive' : 'text-emerald-400/60 hover:text-emerald-400'}`}>
                {e.is_day_off ? <X size={11} /> : <Check size={11} />}
              </button>
            )}
            <div className="min-w-0 flex-1">
              {editingDateKey === `${cellKey}-date` && !readOnly ? (
                <DateInput
                  value={editingDateValue}
                  onChange={setEditingDateValue}
                  min={periodStart}
                  max={periodEnd}
                  periodStart={periodStart}
                  periodEnd={periodEnd}
                  onBlur={() => saveDateEdit(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') saveDateEdit(e);
                    if (ev.key === 'Escape') setEditingDateKey(null);
                  }}
                  className="px-1 py-1 rounded bg-background border border-border text-[10px] min-w-0 w-full"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => toggleDayOff(e)}
                  className={`block -mt-0.5 leading-none sm:leading-normal whitespace-nowrap ${getDayColor(e.entry_date)} ${!readOnly ? 'hover:underline' : 'cursor-default'}`}
                >
                  <span className="font-light text-[10px] sm:text-[9px] opacity-50 mr-1.5">{formatVietnameseDay(e.entry_date).split(' ')[0]}</span>
                  <span className="font-semibold text-[15px] sm:text-[14px]">{formatVietnameseDay(e.entry_date).split(' ')[1]}</span>
                </button>
              )}

              
            </div>
          </div>
        </div>

        {/* Note */}
        <AnimatePresence mode="wait">
          {editingCell === `${cellKey}-note` && !readOnly && !e.is_day_off && !isScheduledOffDay && !separateClockColumns ? (
            <motion.input
              key="note-input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              value={cellValue}
              onChange={ev => setCellValue(ev.target.value)}
              onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
              className="hidden sm:block sm:ml-1 px-2 py-1 rounded bg-background border border-border text-[12px] sm:text-[13px] min-w-0 w-full"
              autoFocus
            />
          ) : showClockChips ? (
            <motion.div 
              key="chips-desktop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden sm:block sm:ml-1"
            >
              {renderClockChips()}
            </motion.div>
          ) : (
            <motion.button
              key="note-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                if (isPreview || e.is_day_off || isScheduledOffDay) return;
                // Only allow editing if there's an actual user note
                if (!e.note) return;
                if (separateClockColumns) {
                  // Manual re-open: still auto-hide after a short delay.
                  showRowChips(cellKey, e.clock_in || defaultClockIn, 'in');
                  return;
                }
                startCellEdit(`${cellKey}-note`, e.note || '');
              }}
              className={`hidden sm:block sm:ml-1 text-left whitespace-nowrap overflow-hidden text-ellipsis text-[13px] sm:text-[14px] mr-1 sm:mr-2 ${
                isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
              } ${!readOnly && !e.is_day_off && !isScheduledOffDay && e.note ? 'hover:text-foreground transition-colors cursor-pointer' : 'cursor-default'}`}
            >
              {e.note || (isScheduledOffDay ? OFF_DAY_NOTE : rateDesc) || '—'}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Clock-in always visible in separate mode (even while chips are active) */}
        {separateClockColumns && (
          <div className="flex items-center justify-center h-full gap-1">
            {/* Clock icon - stays visible with 30% opacity */}
            <AnimatePresence>
              {showClockIcon === cellKey && !readOnly && !e.is_day_off && !isScheduledOffDay && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.3, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    openCellClockPicker(e.entry_date, e.sort_order, 'in', e.clock_in);
                    setShowClockIcon(null);
                  }}
                  className="flex items-center justify-center w-[24px] h-[24px] rounded-full bg-accent/20 text-accent hover:bg-accent/30 hover:opacity-100 transition-all"
                >
                  <Clock size={14} />
                </motion.button>
              )}
            </AnimatePresence>
            {editingCell === `${cellKey}-clock_in` && !readOnly && !e.is_day_off && !isScheduledOffDay ? (
              <button
                onClick={toggleClockInChips}
                className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-orange-400"
              >
                Chọn giờ
              </button>
            ) : (
              <button
                onClick={toggleClockInChips}
                className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-orange-400 hover:underline' : 'text-orange-400 cursor-default'}`}>
                {formatClockDecimal(e.clock_in)}
              </button>
            )}
          </div>
        )}

        {/* Clock-out (separate) OR combined clock column */}
        {separateClockColumns ? (
          <>
            {/* Clock Out */}
            <div className="flex items-center justify-center h-full">
              {editingCell === `${cellKey}-clock_out` && !readOnly && !e.is_day_off && !isScheduledOffDay ? (
                <button
                  onClick={toggleClockOutChips}
                  className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-accent"
                >
                  Chọn giờ
                </button>
              ) : (
                <button onClick={toggleClockOutChips}
                  className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-accent hover:underline' : 'text-accent cursor-default'}`}>
                  {formatClockDecimal(e.clock_out)}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-[0.15rem] min-h-[38px] items-center justify-self-end w-full">
            {editingCell === `${cellKey}-clock_in` && !readOnly && !e.is_day_off && !isScheduledOffDay ? (
              <button
                onClick={toggleClockInChips}
                className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-orange-400"
              >
                Chọn giờ
              </button>
            ) : (
              <button
                onClick={toggleClockInChips}
                className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-orange-400 hover:underline' : 'text-orange-400 cursor-default'} self-center -translate-x-1`}>
                {formatClockDecimal(e.clock_in)}
              </button>
            )}
            {editingCell === `${cellKey}-clock_out` && !readOnly && !e.is_day_off && !isScheduledOffDay ? (
              <button
                onClick={toggleClockOutChips}
                className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-accent"
              >
                Chọn giờ
              </button>
            ) : (
              <button onClick={toggleClockOutChips}
                className={`w-full text-center font-medium ${!readOnly && !e.is_day_off && !isScheduledOffDay ? 'text-accent hover:underline' : 'text-accent cursor-default'} self-center translate-x-1`}>
                {formatClockDecimal(e.clock_out)}
              </button>
            )}
          </div>
        )}

        {/* Hours */}
        <div className="justify-self-end flex items-center h-full">
          <span className="num-cell-sm text-right font-semibold text-[13px] sm:text-[14px]">{formatHours(hours)}</span>
        </div>

        {/* Wage (hours × rate) */}
        <div className="justify-self-end flex items-center h-full">
          <span className="num-cell-sm text-right font-medium text-[13px] sm:text-[14px] text-foreground/70">
            {baseWage > 0 ? (baseWage / 1000).toFixed(0) : '—'}
          </span>
        </div>

        {/* Allowance */}
        <div className="justify-self-end flex items-center h-full">
          <span className="num-cell-sm text-right allowance-amt font-semibold text-[13px] sm:text-[14px]">
            {allowanceAmt > 0 ? (allowanceAmt / 1000).toFixed(0) : ''}
          </span>
        </div>

        {/* Total */}
        <div className="justify-self-end flex items-center h-full">
          <span className="num-cell-xl text-right font-bold text-[14px] sm:text-[16px]">{total > 0 ? (total / 1000).toFixed(0) : '—'}</span>
        </div>
        {showWeekSep && (
          <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full week-separator" />
        )}
      </div>
      </div>
    );
  };

  const renderEmptyRow = (dateStr: string | null, idx: number, showWeekSep: boolean = false) => (
    <div key={`empty-${dateStr || idx}`}>
      <div
        className={`${showWeekSep ? 'relative ' : ''}flex items-start justify-between gap-2 py-2.5 pl-3 pr-3 text-[13px] border-b border-border/20 w-full sm:hidden ${
          idx % 2 !== 0 ? 'bg-muted/40' : ''
        } ${dateStr ? 'opacity-50' : ''} ${
          !readOnly && dateStr && !scheduledOffDays.has(dateStr) ? 'cursor-pointer hover:opacity-70' : ''
        }`}
        onClick={() => {
          if (!readOnly && dateStr && !scheduledOffDays.has(dateStr)) {
            activateEmptyDay(dateStr);
          }
        }}
      >
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-start gap-1.5">
            {!readOnly && dateStr ? (
              <button
                onClick={() => !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                className={`mt-0.5 flex-shrink-0 transition-colors ${
                  scheduledOffDays.has(dateStr)
                    ? 'text-destructive/60 cursor-default'
                    : 'text-destructive/50 hover:text-emerald-400'
                }`}
              >
                <X size={11} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {dateStr ? (
                <button
                  onClick={() => !readOnly && !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                  className={`block -mt-0.5 leading-none whitespace-nowrap ${getDayColor(dateStr)} ${
                    !readOnly && !scheduledOffDays.has(dateStr) ? 'hover:underline' : 'cursor-default'
                  }`}
                >
                  <span className="font-light text-[11px] opacity-50 mr-1.5">{formatVietnameseDay(dateStr).split(' ')[0]}</span>
                  <span className="font-semibold text-[17px]">{formatVietnameseDay(dateStr).split(' ')[1]}</span>
                </button>
              ) : (
                <span className="block font-semibold text-[15px] leading-none whitespace-nowrap opacity-0">00</span>
              )}
              <span className="mt-1 block text-left text-[12px] leading-tight text-muted-foreground">
                {dateStr && scheduledOffDays.has(dateStr) ? OFF_DAY_NOTE : '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="ml-1 flex shrink-0 items-center gap-2 text-right">
          {separateClockColumns ? (
            <>
              <span className="w-[40px] text-center text-muted-foreground">—</span>
              <span className="w-[40px] text-center text-muted-foreground">—</span>
            </>
          ) : (
            <div className="flex w-[40px] flex-col gap-[0.15rem] text-muted-foreground min-h-[38px] items-center justify-center">
              <span className="w-full text-center">—</span>
              <span className="w-full text-center">—</span>
            </div>
          )}
          <span className="num-cell w-[24px] text-right text-muted-foreground font-semibold">—</span>
          <span className="num-cell w-[34px] text-right text-muted-foreground font-semibold">—</span>
          <span className="num-cell w-[30px] text-right text-muted-foreground font-semibold">—</span>
          <span className="num-cell w-[40px] text-right text-[13px] text-muted-foreground font-bold">—</span>
        </div>
        {showWeekSep && (
          <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full week-separator" />
        )}
      </div>
      <div
        className={`${showWeekSep ? 'relative ' : ''}hidden sm:grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[13px] sm:text-[14px] border-b border-border/20 w-full ${
          idx % 2 !== 0 ? 'bg-muted/40' : ''
        } ${dateStr ? 'opacity-50' : ''} ${
          !readOnly && dateStr && !scheduledOffDays.has(dateStr) ? 'cursor-pointer hover:opacity-70' : ''
        }`}
        onClick={() => {
          if (!readOnly && dateStr && !scheduledOffDays.has(dateStr)) {
            activateEmptyDay(dateStr);
          }
        }}
      >
        <div className="pr-4 sm:pr-2">
          <div className="flex items-start gap-1.5">
            {!readOnly && dateStr ? (
              <button
                onClick={() => !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                className={`mt-0.5 flex-shrink-0 transition-colors ${
                  scheduledOffDays.has(dateStr)
                    ? 'text-destructive/60 cursor-default'
                    : 'text-destructive/50 hover:text-emerald-400'
                }`}
              >
                <X size={11} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {dateStr ? (
                <button
                  onClick={() => !readOnly && !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                  className={`block -mt-0.5 leading-none sm:leading-normal whitespace-nowrap ${getDayColor(dateStr)} ${
                    !readOnly && !scheduledOffDays.has(dateStr) ? 'hover:underline' : 'cursor-default'
                  }`}
                >
                  <span className="font-light text-[10px] sm:text-[9px] opacity-50 mr-1.5">{formatVietnameseDay(dateStr).split(' ')[0]}</span>
                  <span className="font-semibold text-[15px] sm:text-[14px]">{formatVietnameseDay(dateStr).split(' ')[1]}</span>
                </button>
              ) : (
                <span className="block font-semibold text-[15px] leading-none sm:text-[14px] sm:leading-normal whitespace-nowrap opacity-0">00</span>
              )}
              <span className="mt-1 block text-left text-[12px] leading-tight text-muted-foreground sm:hidden">
                {dateStr && scheduledOffDays.has(dateStr) ? OFF_DAY_NOTE : '—'}
              </span>
            </div>
          </div>
        </div>
        <span className="hidden sm:block sm:ml-1 text-left text-[13px] sm:text-[14px] text-muted-foreground mr-1 sm:mr-2">
          {dateStr && scheduledOffDays.has(dateStr) ? OFF_DAY_NOTE : '—'}
        </span>
        {separateClockColumns ? (
          <>
            <span className="justify-self-center text-center text-muted-foreground">—</span>
            <span className="justify-self-center text-center text-muted-foreground">—</span>
          </>
        ) : (
          <div className="flex flex-col gap-[0.15rem] text-muted-foreground min-h-[38px] items-center justify-self-end w-full">
            <span className="w-full self-center -translate-x-0.5 text-center">—</span>
            <span className="w-full self-center translate-x-0.5 text-center">—</span>
          </div>
        )}
        <span className="num-cell-sm justify-self-end text-right text-muted-foreground font-semibold">—</span>
        <span className="num-cell-sm justify-self-end text-right text-muted-foreground font-semibold">—</span>
        <span className="num-cell-sm justify-self-end text-right text-muted-foreground font-semibold">—</span>
        <span className="num-cell-md justify-self-end text-right text-[13px] sm:text-[15px] text-muted-foreground font-bold">—</span>
        {showWeekSep && (
          <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full week-separator" />
        )}
      </div>
    </div>
  );

  const renderTableHeader = () => (
    <>
    <div className="flex items-center justify-between gap-2 py-2.5 pl-3 pr-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 w-full sm:hidden">
      <span className="flex items-center justify-center">
        <button
          onClick={() => !readOnly && setAddingDate(prev => !prev)}
          className={`mx-auto flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-wider ${
            !readOnly
              ? 'border-border/60 bg-muted/40 hover:border-border hover:bg-muted/70 hover:text-foreground transition-colors'
              : 'border-border/30 bg-muted/20 cursor-default'
          }`}
          aria-label="Thêm dòng theo ngày"
        >
          <span>Ngày</span>
          <Plus size={11} />
        </button>
      </span>
      <div className="ml-1 flex shrink-0 items-center gap-2 text-right">
        {separateClockColumns ? (
          <>
            <span className="w-[40px] text-center normal-case">Vào</span>
            <span className="w-[40px] text-center normal-case">Ra</span>
          </>
        ) : (
          <span className="w-[40px] text-center normal-case">Vào / Ra</span>
        )}
        <span className="w-[24px] text-right">Giờ</span>
        <span className="w-[34px] text-right">Lương</span>
        <span className="w-[30px] text-right">PC</span>
        <span className="w-[40px] text-right">Tổng</span>
      </div>
    </div>
    <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 w-full`}>
      <span className="flex items-center justify-center sm:justify-center">
        <button
          onClick={() => !readOnly && setAddingDate(prev => !prev)}
          className={`mx-auto flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-wider ${
            !readOnly
              ? 'border-border/60 bg-muted/40 hover:border-border hover:bg-muted/70 hover:text-foreground transition-colors'
              : 'border-border/30 bg-muted/20 cursor-default'
          }`}
          aria-label="Thêm dòng theo ngày"
        >
          <span>Ngày</span>
          <Plus size={11} />
        </button>
      </span>
      <span className="hidden sm:block text-center">{separateClockColumns ? 'Chọn giờ' : 'Ghi chú'}</span>
      {separateClockColumns ? (
        <>
          <span className="text-center">Vào</span>
          <span className="text-center">Ra</span>
        </>
      ) : (
        <span className="text-center">Vào / Ra</span>
      )}
      <span className="text-right">Giờ</span>
      <span className="text-right">Lương</span>
      <span className="text-right">PC</span>
      <span className="text-right">Tổng</span>
    </div>
    </>
  );

  const renderCompact = () => {
    const emptyCount = Math.max(0, 10 - workingEntries.length);
    const emptyRows = Array.from({ length: emptyCount }, (_, i) => ({
      idx: i + workingEntries.length,
      dateStr: null,
    }));

    return (
      <div className="w-full sm:overflow-x-auto pb-2">
        <div className="w-full min-w-0">
          {addingDate && !readOnly && (
            <div className="flex items-center gap-2 px-2 py-2 border-b border-border/20">
              <input
                type="date"
                value={newRowDate}
                min={periodStart}
                max={periodEnd}
                onChange={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                onBlur={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                className="px-2 py-1 rounded bg-background border border-border text-[11px]"
              />
              <button
                onClick={() => {
                  onAddRowAtDate(clampDateToPeriod(newRowDate));
                  setAddingDate(false);
                }}
                className="px-2 py-1 rounded bg-muted text-[10px] text-foreground hover:bg-muted/80 transition-colors"
              >
                Tạo dòng
              </button>
              <button
                onClick={() => setAddingDate(false)}
                className="px-2 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                Hủy
              </button>
            </div>
          )}
          <div className="px-2 py-2 text-[11px] text-muted-foreground font-semibold flex items-center justify-between border-b border-border/40">
            <span>Chế độ gọn · {workingEntries.length} ngày làm</span>
          </div>
          {renderTableHeader()}
          <div className="divide-y divide-border/20">
            {workingEntries.map((e, idx) => renderRow(e, idx, workingEntries))}
            {emptyRows.map(({ idx, dateStr }, mapIdx) => {
              const isSun = dateStr ? new Date(dateStr + 'T00:00:00').getDay() === 0 : false;
              const showWeekSep = isSun && mapIdx < emptyRows.length - 1;
              return renderEmptyRow(dateStr, idx, showWeekSep);
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderPage = (page: { startDate: string; endDate: string; entries: SalaryEntry[] }) => {
    const pageDates = generateDateRange(page.startDate, page.endDate);
    const pageRows = pageDates.map((dateStr, idx) => ({
      idx,
      dateStr,
      entry: page.entries.find(entry => entry.entry_date === dateStr) || null,
    }));
    const orderedEntries = pageRows
      .filter((row): row is { idx: number; dateStr: string; entry: SalaryEntry } => row.entry !== null)
      .map(row => row.entry);

    return (
      <div className="w-full sm:overflow-x-auto pb-2">
        <div className="w-full min-w-0">
          {addingDate && !readOnly && (
            <div className="flex items-center gap-2 px-2 py-2 border-b border-border/20">
              <input
                type="date"
                value={newRowDate}
                min={periodStart}
                max={periodEnd}
                onChange={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                onBlur={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                className="px-2 py-1 rounded bg-background border border-border text-[11px]"
              />
              <button
                onClick={() => {
                  onAddRowAtDate(clampDateToPeriod(newRowDate));
                  setAddingDate(false);
                }}
                className="px-2 py-1 rounded bg-muted text-[10px] text-foreground hover:bg-muted/80 transition-colors"
              >
                Tạo dòng
              </button>
              <button
                onClick={() => setAddingDate(false)}
                className="px-2 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                Hủy
              </button>
            </div>
          )}
          {renderTableHeader()}
          <div className="divide-y divide-border/20">
            {pageRows.map((row, idx) => {
              if (row.entry) return renderRow(row.entry, idx, orderedEntries);
              const isSun = row.dateStr ? new Date(row.dateStr + 'T00:00:00').getDay() === 0 : false;
              const showWeekSep = isSun && idx < pageRows.length - 1;
              return renderEmptyRow(row.dateStr, idx, showWeekSep);
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="glass-card p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {mode === 'admin' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Từ:</span>
                    {pickingRange === 'start' ? (
                      <input type="date" value={customStartDate || periodStart}
                        onChange={e => onCustomDateChange(e.target.value, customEndDate)}
                        onBlur={() => setPickingRange(null)}
                        className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]" autoFocus />
                    ) : (
                      <button
                        onClick={() => setPickingRange('start')}
                        className="px-2 py-0.5 rounded bg-background border border-border text-[10px] hover:bg-muted/60 transition-colors"
                      >
                        {formatDateViet(customStartDate || periodStart)}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Đến:</span>
                    {pickingRange === 'end' ? (
                      <input type="date" value={customEndDate || periodEnd}
                        onChange={e => onCustomDateChange(customStartDate, e.target.value)}
                        onBlur={() => setPickingRange(null)}
                        className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]" autoFocus />
                    ) : (
                      <button
                        onClick={() => setPickingRange('end')}
                        className="px-2 py-0.5 rounded bg-background border border-border text-[10px] hover:bg-muted/60 transition-colors"
                      >
                        {formatDateViet(customEndDate || periodEnd)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground mr-1">Mặc định:</span>
                <button onClick={() => setPickingClock({ scope: 'default', activeKind: 'in', clockIn: defaultClockIn, clockOut: defaultClockOut })} className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[13px] font-semibold text-orange-400 hover:bg-muted transition-colors">
                  {defaultClockIn}
                </button>
                <span className="text-muted-foreground text-[10px]">-</span>
                <button onClick={() => setPickingClock({ scope: 'default', activeKind: 'out', clockIn: defaultClockIn, clockOut: defaultClockOut })} className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[13px] font-semibold text-accent hover:bg-muted transition-colors">
                  {defaultClockOut}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompact(!compact)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                  compact ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {compact ? <Check size={14} /> : <X size={14} />}
                Gọn
              </button>

              <button
                onClick={() => setSeparateClockColumns(!separateClockColumns)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                  separateClockColumns ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {separateClockColumns ? <Check size={14} /> : <X size={14} />}
                Tách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table content */}
      <div className="-mx-4 sm:mx-0">
        {compact ? (
          renderCompact()
        ) : pages.length > 0 ? (
          <SwipeablePages
            pages={pages.map(p => renderPage(p))}
            labels={pages.map(p => `${formatDateViet(p.startDate)} — ${formatDateViet(p.endDate)}`)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        ) : (
          <div className="glass-card p-6 text-center text-muted-foreground text-xs">Chưa có dữ liệu</div>
        )}
      </div>

      {/* Allowances */}
      {mode === 'employee' ? (
        <div className="glass-card p-3">
          <button
            onClick={() => {
              // Auto-save is already handled by useEffect in parent
              // This button is just for user feedback
              console.log('Manual save triggered');
            }}
            disabled={readOnly}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-all shadow-lg ${
              readOnly
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700'
            }`}
          >
            {readOnly ? 'Đã công bố - Không thể chỉnh sửa' : 'Lưu'}
          </button>
          {!readOnly && (
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Thay đổi được lưu tự động. Bạn có thể tiếp tục chỉnh sửa cho đến khi admin công bố.
            </p>
          )}
        </div>
      ) : (
        <>
          <EmployeeAllowanceEditor
            allowances={allowances}
            onToggle={onAllowanceToggle}
            onUpdate={onAllowanceUpdate}
            onAddAllowance={onAddAllowance}
            isAdmin={mode === 'admin'}
          />
          {/* Total - only show for admin */}
          <TotalSalaryDisplay
            total={breakdown?.total ?? 0}
            onTap={() => setShowBreakdown(true)}
          />
        </>
      )}

      <SalaryBreakdownPopup
        isOpen={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        breakdown={breakdown}
        visibleAllowanceKeys={mode === 'employee' ? ['gui_xe'] : null}
      />

      {pickingClock && (
        <AnalogClock
          mode="range"
          initialActiveField={pickingClock.activeKind}
          initialClockIn={pickingClock.clockIn}
          initialClockOut={pickingClock.clockOut}
          label={
            pickingClock.scope === 'default'
              ? 'Giờ mặc định'
              : 'Giờ vào / ra'
          }
          onTimeRangeSelect={({ clockIn, clockOut }) => {
            if (pickingClock.scope === 'default') {
              setDefaultClockIn(clockIn);
              setDefaultClockOut(clockOut);
              void onDefaultClockInChange?.(clockIn);
              void onDefaultClockOutChange?.(clockOut);
            } else if (pickingClock.entryDate && pickingClock.sortOrder !== undefined) {
              onEntryUpdate(
                pickingClock.entryDate,
                pickingClock.sortOrder,
                {
                  clock_in: clockIn,
                  clock_out: clockOut,
                  total_hours: calcHoursFromTimes(clockIn, clockOut),
                },
              );
            }
            setEditingCell(null);
            setPickingClock(null);
          }}
          onClose={() => {
            setPickingClock(null);
            setEditingCell(null);
          }}
        />
      )}
    </div>
  );
}
