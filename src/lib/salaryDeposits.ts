import { SalaryBreakdown } from '@/types/salary';

export interface SalaryDepositItem {
  id: string;
  label: string;
  amount: number;
}

export const DEFAULT_DEPOSIT_LABEL = 'Tạm ứng';

export function newDepositItem(
  label: string = DEFAULT_DEPOSIT_LABEL,
  amount: number = 0,
): SalaryDepositItem {
  return {
    id: `dep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    amount,
  };
}

/** Prefer `deposits[]`; fall back to legacy single deposit/deposit_label. */
export function normalizeDeposits(
  breakdown: Pick<SalaryBreakdown, 'deposit' | 'deposit_label' | 'deposits'> | null | undefined,
): SalaryDepositItem[] {
  if (breakdown?.deposits && breakdown.deposits.length > 0) {
    return breakdown.deposits
      .filter(d => (d?.amount ?? 0) > 0 || (d?.label ?? '').trim().length > 0)
      .map((d, i) => ({
        id: d.id || `legacy-${i}`,
        label: (d.label || DEFAULT_DEPOSIT_LABEL).trim() || DEFAULT_DEPOSIT_LABEL,
        amount: Math.max(0, d.amount || 0),
      }));
  }
  if ((breakdown?.deposit ?? 0) > 0) {
    return [{
      id: 'legacy',
      label: breakdown?.deposit_label?.trim() || DEFAULT_DEPOSIT_LABEL,
      amount: breakdown!.deposit!,
    }];
  }
  return [];
}

export function sumDeposits(items: SalaryDepositItem[]): number {
  return items.reduce((s, d) => s + (d.amount || 0), 0);
}

/** Keep legacy `deposit` / `deposit_label` in sync for older readers. */
export function withSyncedDepositFields<T extends SalaryBreakdown>(
  breakdown: T,
  deposits: SalaryDepositItem[],
): T {
  const active = deposits.filter(d => d.amount > 0);
  return {
    ...breakdown,
    deposits: active,
    deposit: sumDeposits(active),
    deposit_label: active[0]?.label || DEFAULT_DEPOSIT_LABEL,
  };
}
