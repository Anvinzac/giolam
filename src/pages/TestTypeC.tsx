import { useState } from 'react';
import SalaryTableTypeC from '../components/salary/SalaryTableTypeC';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance } from '../types/salary';

const MOCK_ENTRIES: SalaryEntry[] = [];

const MOCK_RATES: SpecialDayRate[] = [];

const MOCK_ALLOWANCES: EmployeeAllowance[] = [];

export default function TestTypeC() {
  return (
    <div className="p-8 max-w-4xl mx-auto bg-background min-h-screen text-foreground">
      <h1 className="text-2xl font-bold mb-6">Test Preview: Type C Table (Empty)</h1>
      <SalaryTableTypeC
        entries={MOCK_ENTRIES}
        rates={MOCK_RATES}
        allowances={MOCK_ALLOWANCES}
        hourlyRate={25000}
        periodStart="2024-03-01"
        periodEnd="2024-03-31"
        customStartDate={null}
        customEndDate={null}
        onEntryUpdate={() => {}}
        onAllowanceToggle={() => {}}
        onAllowanceUpdate={() => {}}
        onHourlyRateChange={() => {}}
        onCustomDateChange={() => {}}
        breakdown={{
          base_salary: 0,
          daily_base: 0,
          total_daily_wages: 0,
          total_allowances_from_rates: 0,
          total_deductions: 0,
          allowances: [],
          total: 0
        }}
      />
    </div>
  );
}
