/**
 * Type definitions for Type B Immersive Input components
 * 
 * This file contains all TypeScript interfaces for the immersive,
 * card-based salary entry interface designed for Type B employees.
 */

import { SalaryEntry, SpecialDayRate, EmployeeAllowance, SalaryBreakdown } from '@/types/salary';

/**
 * Props for the main ImmersiveInputTypeB component
 * 
 * This component manages the sequential card-based input flow,
 * displaying working days one at a time in squircle cards.
 */
export interface ImmersiveInputTypeBProps {
  /** Array of salary entries for the current period */
  entries: SalaryEntry[];
  
  /** Special day rates (weekends, holidays, lunar dates) */
  rates: SpecialDayRate[];
  
  /** Employee allowances (parking, attendance, etc.) */
  allowances: EmployeeAllowance[];
  
  /** Base monthly salary for the employee */
  baseSalary: number;
  
  /** Hourly overtime rate */
  hourlyRate: number;
  
  /** Fixed clock-in time for Type B employees */
  globalClockIn: string;
  
  /** Period start date (YYYY-MM-DD) */
  periodStart: string;
  
  /** Period end date (YYYY-MM-DD) */
  periodEnd: string;
  
  /** Callback to update a salary entry */
  onEntryUpdate: (entryDate: string, sortOrder: number, updates: Partial<SalaryEntry>) => void;
  
  /** Computed salary breakdown for display */
  breakdown: SalaryBreakdown | null;
  
  /** Current user ID for audit tracking */
  currentUserId: string;
}

/**
 * Internal state for the ImmersiveInputTypeB component
 */
export interface ImmersiveState {
  /** Index of the currently focused working day */
  currentDayIndex: number;
  
  /** Whether a transition animation is in progress */
  isTransitioning: boolean;
  
  /** Whether the user is editing the previous day */
  editingPreviousDay: boolean;
}

/**
 * Props for the SquircleCard component
 * 
 * Displays a single working day in a large, rounded square card.
 * Can be in either "focus" state (interactive) or "review" state (read-only).
 */
export interface SquircleCardProps {
  /** The salary entry to display */
  entry: SalaryEntry;
  
  /** Rate percentage for this day (from special day rates) */
  rate: number;
  
  /** Fixed clock-in time */
  globalClockIn: string;
  
  /** Daily base wage amount */
  dailyBase: number;
  
  /** Hourly overtime rate */
  hourlyRate: number;
  
  /** Card state: 'focus' (bottom, interactive) or 'review' (top, read-only) */
  state: 'focus' | 'review';
  
  /** Callback when a clock-out time chip is selected */
  onClockOutSelect: (time: string) => void;
  
  /** Optional callback when review card is tapped for editing */
  onEdit?: () => void;
  
  /** Whether a transition animation is in progress */
  isTransitioning: boolean;
}

/**
 * Props for the ClockOutChipGrid component
 * 
 * Displays a grid of tappable time chips for clock-out selection.
 * Times are generated in 30-minute increments from the base time.
 */
export interface ClockOutChipGridProps {
  /** Base time (clock-in) to calculate chip times from */
  baseTime: string;
  
  /** Currently selected clock-out time (if any) */
  selectedTime: string | null;
  
  /** Callback when a time chip is selected */
  onSelect: (time: string) => void;
  
  /** Whether the chip grid is disabled (during transitions) */
  disabled: boolean;
}

/**
 * View mode for the salary entry interface
 */
export type ViewMode = 'table' | 'immersive';

/**
 * Props for the ViewToggle component
 * 
 * Allows users to switch between table view and immersive view.
 */
export interface ViewToggleProps {
  /** Current active view mode */
  currentView: ViewMode;
  
  /** Callback when view mode is changed */
  onToggle: (view: ViewMode) => void;
}

/**
 * Computed data for a working day (derived from SalaryEntry + rates)
 */
export interface WorkingDay {
  /** The underlying salary entry */
  entry: SalaryEntry;
  
  /** Rate percentage for this day */
  rate: number;
  
  /** Daily base wage */
  dailyWage: number;
  
  /** Allowance amount for this day */
  allowanceAmount: number;
  
  /** Extra wage from overtime hours */
  extraWage: number;
  
  /** Total wage for this day */
  totalWage: number;
}
