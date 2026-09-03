import { formatDateViet } from '@/lib/salaryCalculations';
import { normalizeDeposits, sumDeposits, type SalaryDepositItem } from '@/lib/salaryDeposits';
import type { SalaryBreakdown } from '@/types/salary';

export const SALARY_PERIOD_EXPORT_VERSION = '1.1';

/** Machine-readable schema so another app knows how to import this file. */
export const SALARY_PERIOD_EXPORT_SCHEMA = {
  version: SALARY_PERIOD_EXPORT_VERSION,
  description:
    'Published payroll export for one completed working period. ' +
    'Import apps should read `employees[]` and match rows by `account` (login username).',
  root_fields: {
    schema: 'Self-describing import contract (this object).',
    period: 'Payroll period metadata (id, start_date, end_date, label).',
    exported_at: 'ISO-8601 timestamp when this file was generated.',
    employees: 'One row per employee with a published salary for this period.',
    summary: 'Roll-up counts and totals for validation after import.',
  },
  employee_fields: {
    account: 'Login username (profiles.username). Required. Unique within the file.',
    name: 'Display name (profiles.full_name). Required.',
    amount: 'Published gross salary in VND (salary_records.total_salary). Required.',
    deposits:
      'Optional list of named deductions/advances ({ label, amount }). Prefer this over deposit.',
    deposit: 'Optional sum of all deposits (legacy). Defaults to 0. Prefer deposits[].',
    deposit_label:
      'Optional display name of the first deposit (legacy). Prefer deposits[].label.',
    transfer_amount: 'Optional net bank transfer = amount - deposit (sum of deposits).',
    published_at: 'Optional ISO timestamp when this employee payroll was published.',
  },
  import_notes: [
    'Only employees with status=published are included.',
    'amount is the gross published total, not the net transfer.',
    'Prefer deposits[] when present; otherwise use deposit / deposit_label.',
    'Use transfer_amount when paying net of deposit/advance.',
    'Period is complete when end_date is before today (local calendar day).',
  ],
} as const;

export interface SalaryPeriodExportEmployee {
  account: string;
  name: string;
  amount: number;
  deposits?: { label: string; amount: number }[];
  deposit?: number;
  deposit_label?: string;
  transfer_amount?: number;
  published_at?: string;
}

export interface SalaryPeriodExportPayload {
  schema: typeof SALARY_PERIOD_EXPORT_SCHEMA;
  period: {
    id: string;
    start_date: string;
    end_date: string;
    label: string;
  };
  exported_at: string;
  employees: SalaryPeriodExportEmployee[];
  summary: {
    employee_count: number;
    total_amount: number;
    total_deposit: number;
    total_transfer: number;
  };
}

export interface SalaryPeriodExportProfile {
  user_id: string;
  username: string | null;
  full_name: string;
}

export interface SalaryPeriodExportRecord {
  user_id: string;
  total_salary: number;
  salary_breakdown: Pick<SalaryBreakdown, 'deposit' | 'deposit_label' | 'deposits'> | null;
  published_at: string | null;
}

export function isPayrollPeriodCompleted(endDate: string, todayStr?: string): boolean {
  const today = todayStr ?? new Date().toISOString().slice(0, 10);
  return endDate < today;
}

function exportDepositRows(items: SalaryDepositItem[]): { label: string; amount: number }[] {
  return items
    .filter(d => d.amount > 0)
    .map(d => ({ label: d.label, amount: d.amount }));
}

export function buildSalaryPeriodExport(
  period: { id: string; start_date: string; end_date: string },
  employees: SalaryPeriodExportProfile[],
  publishedRecords: SalaryPeriodExportRecord[],
): SalaryPeriodExportPayload {
  const byUser = new Map(publishedRecords.map(r => [r.user_id, r]));
  const rows: SalaryPeriodExportEmployee[] = [];

  for (const emp of employees) {
    const rec = byUser.get(emp.user_id);
    if (!rec) continue;
    const depositItems = normalizeDeposits(rec.salary_breakdown);
    const deposit = sumDeposits(depositItems);
    const depositRows = exportDepositRows(depositItems);
    const amount = rec.total_salary ?? 0;
    rows.push({
      account: emp.username || emp.user_id,
      name: emp.full_name,
      amount,
      ...(depositRows.length > 0 ? { deposits: depositRows } : {}),
      ...(deposit > 0 ? { deposit } : {}),
      ...(deposit > 0 && depositRows[0]?.label ? { deposit_label: depositRows[0].label } : {}),
      ...(deposit > 0 ? { transfer_amount: amount - deposit } : {}),
      ...(rec.published_at ? { published_at: rec.published_at } : {}),
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalDeposit = rows.reduce((s, r) => s + (r.deposit ?? 0), 0);

  return {
    schema: SALARY_PERIOD_EXPORT_SCHEMA,
    period: {
      id: period.id,
      start_date: period.start_date,
      end_date: period.end_date,
      label: `${formatDateViet(period.start_date)} – ${formatDateViet(period.end_date)}`,
    },
    exported_at: new Date().toISOString(),
    employees: rows,
    summary: {
      employee_count: rows.length,
      total_amount: totalAmount,
      total_deposit: totalDeposit,
      total_transfer: totalAmount - totalDeposit,
    },
  };
}

export function serializeSalaryPeriodExport(payload: SalaryPeriodExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function downloadSalaryPeriodExport(payload: SalaryPeriodExportPayload): void {
  const json = serializeSalaryPeriodExport(payload);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll_${payload.period.start_date}_${payload.period.end_date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
