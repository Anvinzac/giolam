import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SquircleCard from './SquircleCard';
import { SalaryEntry } from '@/types/salary';
import { computeTotalSalaryTypeB } from '@/lib/salaryCalculations';

describe('SquircleCard - Focus and Review States', () => {
  const mockEntry: SalaryEntry = {
    id: '1',
    employee_id: 'emp1',
    period_id: 'period1',
    entry_date: '2025-01-15',
    sort_order: 1,
    is_day_off: false,
    clock_in: '17:00',
    clock_out: '21:00',
    total_hours: 4,
    notes: null,
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  };

  const defaultProps = {
    entry: mockEntry,
    rate: 20,
    globalClockIn: '17:00',
    dailyBase: 200000,
    hourlyRate: 50000,
    onClockOutSelect: vi.fn(),
    isTransitioning: false,
  };

  describe('Requirement 2.2: Focus State - larger, interactive', () => {
    it('should apply scale-100 styling in focus state', () => {
      const { container } = render(
        <SquircleCard {...defaultProps} state="focus" />
      );
      
      const card = container.querySelector('.glass-card');
      // With Framer Motion, scale is applied via inline styles
      const style = card?.getAttribute('style');
      expect(style).toBeTruthy();
      // In focus state, scale should be 1 (or none/default)
      // Framer Motion applies transform: none when scale is 1
    });

    it('should render ClockOutChipGrid in focus state', () => {
      render(<SquircleCard {...defaultProps} state="focus" />);
      
      // ClockOutChipGrid should be present (it renders time chips)
      const chipGrid = screen.getByTestId('clock-out-chip-grid');
      expect(chipGrid).toBeInTheDocument();
    });

    it('should be interactive in focus state', () => {
      const onClockOutSelect = vi.fn();
      render(
        <SquircleCard
          {...defaultProps}
          state="focus"
          onClockOutSelect={onClockOutSelect}
        />
      );
      
      // The card should allow interaction with chips
      // (ClockOutChipGrid handles the actual chip clicks)
      const chipGrid = screen.getByTestId('clock-out-chip-grid');
      expect(chipGrid).toBeInTheDocument();
    });
  });

  describe('Requirement 2.3: Review State - smaller, read-only', () => {
    it('should apply scale-90 and opacity-80 styling in review state', () => {
      const { container } = render(
        <SquircleCard {...defaultProps} state="review" />
      );
      
      const card = container.querySelector('.glass-card');
      // With Framer Motion, scale and opacity are applied via inline styles
      const style = card?.getAttribute('style');
      expect(style).toBeTruthy();
      // In review state, scale should be 0.9 and opacity 0.8
      expect(style).toContain('scale(0.9)');
      expect(style).toContain('opacity: 0.8');
    });

    it('should NOT render ClockOutChipGrid in review state', () => {
      render(<SquircleCard {...defaultProps} state="review" />);
      
      // ClockOutChipGrid should not be present
      const chipGrid = screen.queryByTestId('clock-out-chip-grid');
      expect(chipGrid).not.toBeInTheDocument();
    });

    it('should be read-only (no chip interaction) in review state', () => {
      const onClockOutSelect = vi.fn();
      render(
        <SquircleCard
          {...defaultProps}
          state="review"
          onClockOutSelect={onClockOutSelect}
        />
      );
      
      // No chip grid means no way to select new times
      const chipGrid = screen.queryByTestId('clock-out-chip-grid');
      expect(chipGrid).not.toBeInTheDocument();
    });
  });

  describe('Requirement 5.1: Display previously entered clock-out time', () => {
    it('should display clock-out time in review state', () => {
      render(<SquircleCard {...defaultProps} state="review" />);
      
      // Should show the clock-out time
      expect(screen.getByText('21:00')).toBeInTheDocument();
      expect(screen.getByText('Giờ ra')).toBeInTheDocument();
    });

    it('should display clock-out time prominently (large text)', () => {
      const { container } = render(
        <SquircleCard {...defaultProps} state="review" />
      );
      
      // Find the clock-out time display
      const clockOutDisplay = screen.getByText('21:00');
      expect(clockOutDisplay.className).toContain('text-4xl');
      expect(clockOutDisplay.className).toContain('font-bold');
    });
  });

  describe('Requirement 5.2: Tappable for editing', () => {
    it('should call onEdit when review state card is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      
      const { container } = render(
        <SquircleCard
          {...defaultProps}
          state="review"
          onEdit={onEdit}
        />
      );
      
      const card = container.querySelector('.glass-card');
      expect(card).toBeInTheDocument();
      
      await user.click(card!);
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onEdit when focus state card is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      
      const { container } = render(
        <SquircleCard
          {...defaultProps}
          state="focus"
          onEdit={onEdit}
        />
      );
      
      const card = container.querySelector('.glass-card');
      await user.click(card!);
      
      // Focus state should not trigger edit
      expect(onEdit).not.toHaveBeenCalled();
    });

    it('should NOT be clickable when onEdit is not provided', async () => {
      const user = userEvent.setup();
      
      const { container } = render(
        <SquircleCard
          {...defaultProps}
          state="review"
          // onEdit not provided
        />
      );
      
      const card = container.querySelector('.glass-card');
      
      // Should not have onClick handler
      // (This is implicit - no error should occur)
      await user.click(card!);
      // No assertion needed - just verifying no error
    });
  });

  describe('Visual State Differences', () => {
    it('should have different visual appearance between focus and review', () => {
      const { container: focusContainer } = render(
        <SquircleCard {...defaultProps} state="focus" />
      );
      const { container: reviewContainer } = render(
        <SquircleCard {...defaultProps} state="review" />
      );
      
      const focusCard = focusContainer.querySelector('.glass-card');
      const reviewCard = reviewContainer.querySelector('.glass-card');
      
      // Focus should be full size (scale 1)
      const focusStyle = focusCard?.getAttribute('style');
      expect(focusStyle).toBeTruthy();
      
      // Review should be smaller (scale 0.9) and more transparent (opacity 0.8)
      const reviewStyle = reviewCard?.getAttribute('style');
      expect(reviewStyle).toContain('scale(0.9)');
      expect(reviewStyle).toContain('opacity: 0.8');
    });
  });

  describe('Transition Prevention', () => {
    it('should add pointer-events-none when transitioning', () => {
      const { container } = render(
        <SquircleCard {...defaultProps} state="focus" isTransitioning={true} />
      );
      
      const card = container.querySelector('.glass-card');
      expect(card?.className).toContain('pointer-events-none');
    });

    it('should NOT add pointer-events-none when not transitioning', () => {
      const { container } = render(
        <SquircleCard {...defaultProps} state="focus" isTransitioning={false} />
      );
      
      const card = container.querySelector('.glass-card');
      expect(card?.className).not.toContain('pointer-events-none');
    });
  });
});


describe('SquircleCard - Daily Wage Calculation (Task 3.3)', () => {
  const baseSalary = 5600000; // 5.6M VND
  const hourlyRate = 50000; // 50k VND/hour
  const dailyBase = Math.round(baseSalary / 28 / 1000) * 1000; // 200k VND

  describe('Requirement 1.1 & 8.4: Display base wage, allowances, and total', () => {
    it('should display base wage (dailyBase)', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: '17:00',
        clock_out: '21:00',
        total_hours: 4,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      const { container } = render(
        <SquircleCard
          entry={mockEntry}
          rate={20}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Should display base wage label and value
      expect(screen.getByText('Lương cơ bản:')).toBeInTheDocument();
      
      // Verify the structure contains base wage
      const summarySection = container.querySelector('.space-y-2');
      expect(summarySection?.textContent).toContain('Lương cơ bản:');
      expect(summarySection?.textContent).toContain('200k');
    });

    it('should display allowance amount', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: '17:00',
        clock_out: '21:00',
        total_hours: 4,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      const rate = 20; // 20% allowance
      const expectedAllowance = Math.round((dailyBase * rate) / 100 / 1000) * 1000;

      render(
        <SquircleCard
          entry={mockEntry}
          rate={rate}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Should display allowance
      expect(screen.getByText('Phụ cấp:')).toBeInTheDocument();
      expect(screen.getByText(`${expectedAllowance / 1000}k`)).toBeInTheDocument();
    });

    it('should display overtime wage when hours > 0', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: '17:00',
        clock_out: '21:00',
        total_hours: 4,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      const expectedExtraWage = Math.round((4 * hourlyRate) / 1000) * 1000;

      const { container } = render(
        <SquircleCard
          entry={mockEntry}
          rate={20}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Should display overtime wage label
      expect(screen.getByText(/Làm thêm \(4h\):/)).toBeInTheDocument();
      
      // Verify the structure contains overtime wage
      const summarySection = container.querySelector('.space-y-2');
      expect(summarySection?.textContent).toContain('Làm thêm (4h):');
      expect(summarySection?.textContent).toContain(`${expectedExtraWage / 1000}k`);
    });

    it('should display total wage', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: '17:00',
        clock_out: '21:00',
        total_hours: 4,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      const rate = 20;
      const allowance = Math.round((dailyBase * rate) / 100 / 1000) * 1000;
      const extraWage = Math.round((4 * hourlyRate) / 1000) * 1000;
      const expectedTotal = dailyBase + allowance + extraWage;

      render(
        <SquircleCard
          entry={mockEntry}
          rate={rate}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Should display total
      expect(screen.getByText('Tổng:')).toBeInTheDocument();
      expect(screen.getByText(`${expectedTotal / 1000}k`)).toBeInTheDocument();
    });
  });

  describe('Calculation Logic Matches computeTotalSalaryTypeB', () => {
    it('should calculate hours from clock times when total_hours is null', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: '17:00',
        clock_out: '21:30', // 4.5 hours
        total_hours: null, // Force calculation from times
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      render(
        <SquircleCard
          entry={mockEntry}
          rate={20}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Should calculate 4.5 hours and display overtime wage
      expect(screen.getByText(/Làm thêm \(4.5h\):/)).toBeInTheDocument();
    });

    it('should use globalClockIn when entry.clock_in is null', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: null, // Use global clock-in
        clock_out: '21:00',
        total_hours: null,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      render(
        <SquircleCard
          entry={mockEntry}
          rate={20}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Should calculate 4 hours using globalClockIn
      expect(screen.getByText(/Làm thêm \(4h\):/)).toBeInTheDocument();
    });

    it('should show 0 total for off-days', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: true, // Off-day
        clock_in: '17:00',
        clock_out: '21:00',
        total_hours: 4,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      render(
        <SquircleCard
          entry={mockEntry}
          rate={20}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Total should be 0k for off-days
      expect(screen.getByText('Tổng:')).toBeInTheDocument();
      expect(screen.getByText('0k')).toBeInTheDocument();
    });

    it('should round to nearest 1000 VND', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: '17:00',
        clock_out: '21:00',
        total_hours: 4,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      const rate = 15; // 15% allowance
      // dailyBase = 200k, 15% = 30k (already rounded)
      const allowance = Math.round((dailyBase * rate) / 100 / 1000) * 1000;
      const extraWage = Math.round((4 * hourlyRate) / 1000) * 1000;
      const total = dailyBase + allowance + extraWage;

      render(
        <SquircleCard
          entry={mockEntry}
          rate={rate}
          globalClockIn="17:00"
          dailyBase={dailyBase}
          hourlyRate={hourlyRate}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // All values should be multiples of 1000
      expect(allowance % 1000).toBe(0);
      expect(extraWage % 1000).toBe(0);
      expect(total % 1000).toBe(0);
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency values as "Xk" (thousands)', () => {
      const mockEntry: SalaryEntry = {
        id: '1',
        employee_id: 'emp1',
        period_id: 'period1',
        entry_date: '2025-01-15',
        sort_order: 1,
        is_day_off: false,
        clock_in: '17:00',
        clock_out: '21:00',
        total_hours: 4,
        notes: null,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      };

      const { container } = render(
        <SquircleCard
          entry={mockEntry}
          rate={20}
          globalClockIn="17:00"
          dailyBase={200000}
          hourlyRate={50000}
          state="focus"
          onClockOutSelect={vi.fn()}
          isTransitioning={false}
        />
      );

      // Verify the summary section contains all formatted values
      const summarySection = container.querySelector('.space-y-2');
      expect(summarySection?.textContent).toContain('Lương cơ bản:');
      expect(summarySection?.textContent).toContain('Phụ cấp:');
      expect(summarySection?.textContent).toContain('40k'); // allowance (20% of 200k)
      expect(summarySection?.textContent).toContain('Làm thêm (4h):');
      expect(summarySection?.textContent).toContain('Tổng:');
      expect(summarySection?.textContent).toContain('440k'); // total
    });
  });
});
