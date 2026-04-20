export type AllowanceKey = 'chuyen_can' | 'nang_luc' | 'gui_xe' | (string & {});

export type DayType =
  | 'saturday'
  | 'sunday'
  | 'day_before_new_moon'
  | 'day_before_full_moon'
  | 'new_moon'
  | 'full_moon'
  | 'public_holiday'
  | 'custom';

export type OffPercent = 0 | 25 | 50 | 75;
export type SalaryStatus = 'draft' | 'published';
export type EmployeeShiftType = 'basic' | 'overtime' | 'notice_only' | 'lunar_rate';

export interface SpecialDayRate {
  id?: string;
  period_id: string;
  special_date: string;
  day_type: DayType;
  description_vi: string;
  rate_percent: number;
  sort_order: number;
}

export interface EmployeeAllowance {
  id?: string;
  user_id: string;
  period_id: string;
  allowance_key: AllowanceKey;
  label: string;
  amount: number;
  is_enabled: boolean;
}

export interface SalaryEntry {
  id?: string;
  user_id: string;
  period_id: string;
  entry_date: string;
  sort_order: number;
  is_day_off: boolean;
  off_percent: number;
  note: string | null;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  allowance_rate_override: number | null;
  base_daily_wage: number;
  allowance_amount: number;
  extra_wage: number;
  total_daily_wage: number;
  submitted_by?: string | null;
  is_admin_reviewed?: boolean;
  last_employee_edit_at?: string | null;
}

export interface SalaryRecord {
  id?: string;
  user_id: string;
  period_id: string;
  total_salary: number;
  salary_breakdown: SalaryBreakdown | null;
  status: SalaryStatus;
  published_at: string | null;
}

export interface SalaryBreakdown {
  base_salary: number;
  daily_base: number;
  total_daily_wages: number;
  total_allowances_from_rates: number;
  total_deductions: number;
  allowances: { key: AllowanceKey; label: string; amount: number; enabled: boolean }[];
  total: number;
}

export interface SalaryPage {
  pageIndex: number;
  startDate: string;
  endDate: string;
  entries: SalaryEntry[];
}

export const DEFAULT_ALLOWANCE_LABELS: Record<AllowanceKey, string> = {
  chuyen_can: 'Chuyên cần',
  nang_luc: 'Năng lực',
  gui_xe: 'Gửi xe',
};

export const DEFAULT_RATES: Record<DayType, number> = {
  saturday: 15,
  sunday: 20,
  day_before_new_moon: 15,
  day_before_full_moon: 15,
  new_moon: 40,
  full_moon: 40,
  public_holiday: 0,
  custom: 0,
};

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  saturday: 'Thứ Bảy',
  sunday: 'Chủ Nhật',
  day_before_new_moon: 'Ngày chay',
  day_before_full_moon: 'Ngày chay',
  new_moon: 'Mùng 1',
  full_moon: 'Rằm',
  public_holiday: 'Ngày lễ',
  custom: 'Khác',
};

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeShiftType, string> = {
  basic: 'Loại A',
  overtime: 'Loại B',
  notice_only: 'Loại C',
  lunar_rate: 'Loại D',
};
