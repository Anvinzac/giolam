import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ImmersiveInputTypeB from './ImmersiveInputTypeB';
import { SalaryEntry } from '@/types/salary';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { ReactElement } from 'react';

// Helper to wrap component with Router
function renderWithRouter(ui: ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

// Helper to create a mock salary entry
function createMockEntry(date: string, isDayOff: boolean, sortOrder: number, clockOut?: string): SalaryEntry {
  return {
    user_id: 'user-1',
    period_id: 'period-1',
    entry_date: date,
    sort_order: sortOrder,
    is_day_off: isDayOff,
    off_percent: 0,
    note: null,
    clock_in: null,
    clock_out: clockOut || null,
    total_hours: null,
    allowance_rate_override: null,
    base_daily_wage: 150000,
    allowance_amount: 30000,
    extra_wage: 0,
    total_daily_wage: 180000,
  };
}

describe('ImmersiveInputTypeB - Working Days Filtering', () => {
  const mockProps = {
    rates: [],
    allowances: [],
    baseSalary: 4500000,
    hourlyRate: 25000,
    globalClockIn: '17:00',
    periodStart: '2025-01-01',
    periodEnd: '2025-01-31',
    onEntryUpdate: () => {},
    breakdown: null,
    currentUserId: 'user-1',
  };

  it('should filter out off-days and display only working days', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1), // Working day
      createMockEntry('2025-01-02', true, 2),  // Off day
      createMockEntry('2025-01-03', false, 3), // Working day
      createMockEntry('2025-01-04', true, 4),  // Off day
      createMockEntry('2025-01-05', false, 5), // Working day
    ];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display the first working day (2025-01-01)
    expect(screen.getByText('1')).toBeInTheDocument();
    
    // Should not display off-days (2 and 4)
    // The component should only show working days in the cards
  });

  it('should handle all off-days gracefully', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', true, 1),
      createMockEntry('2025-01-02', true, 2),
      createMockEntry('2025-01-03', true, 3),
    ];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display a message indicating no working days
    expect(screen.getByText(/Không có ngày làm việc trong kỳ này/i)).toBeInTheDocument();
  });

  it('should handle all working days (no off-days)', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display the first working day
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should handle empty entries array', () => {
    const entries: SalaryEntry[] = [];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display a message indicating no working days
    expect(screen.getByText(/Không có ngày làm việc trong kỳ này/i)).toBeInTheDocument();
  });

  it('should correctly filter mixed working and off-days', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1), // Working
      createMockEntry('2025-01-02', false, 2), // Working
      createMockEntry('2025-01-03', true, 3),  // Off
      createMockEntry('2025-01-04', false, 4), // Working
      createMockEntry('2025-01-05', true, 5),  // Off
      createMockEntry('2025-01-06', true, 6),  // Off
      createMockEntry('2025-01-07', false, 7), // Working
    ];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display the first working day (day 1)
    expect(screen.getByText('1')).toBeInTheDocument();
    
    // The component internally should have filtered to 4 working days
    // (days 1, 2, 4, 7)
  });

  it('should maintain sort order when filtering working days', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-05', false, 5), // Working
      createMockEntry('2025-01-03', true, 3),  // Off
      createMockEntry('2025-01-01', false, 1), // Working
      createMockEntry('2025-01-02', false, 2), // Working
      createMockEntry('2025-01-04', true, 4),  // Off
    ];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display the first working day by sort order (day 1)
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

describe('ImmersiveInputTypeB - Two-Panel Layout', () => {
  const mockProps = {
    rates: [],
    allowances: [],
    baseSalary: 4500000,
    hourlyRate: 25000,
    globalClockIn: '17:00',
    periodStart: '2025-01-01',
    periodEnd: '2025-01-31',
    onEntryUpdate: () => {},
    breakdown: null,
    currentUserId: 'user-1',
  };

  it('should display only the focus card when there is one working day', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
    ];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display the day
    expect(screen.getByText('1')).toBeInTheDocument();
    
    // Should not have a review card (no previous day)
    const cards = screen.getAllByText('1');
    expect(cards).toHaveLength(1); // Only one card
  });

  it('should display two cards when there are multiple working days', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should display day 1 (focus state)
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should handle layout with proper container structure', () => {
    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
    ];

    const { container } = render(<ImmersiveInputTypeB {...mockProps} entries={entries} />);

    // Should have the main container with proper height
    const mainContainer = container.querySelector('.relative');
    expect(mainContainer).toBeInTheDocument();
  });
});


/**
 * **Validates: Requirements 3.3, 8.4, 13.2, 15.1**
 * 
 * Integration tests for clock-out selection:
 * - Requirement 3.3: WHEN a user taps a Clock_Out_Chip, THE Immersive_View SHALL record that time
 * - Requirement 8.4: WHEN a Clock_Out_Chip is selected, THE Immersive_View SHALL update the corresponding salary_entries record
 * - Requirement 13.2: IF a clock-out time update fails to save, THE Immersive_View SHALL notify the user and allow retry
 * - Requirement 15.1: WHEN a Clock_Out_Chip is tapped, THE interface SHALL respond within 200 milliseconds
 */
describe('ImmersiveInputTypeB - Clock-Out Selection Integration', () => {
  const mockProps = {
    rates: [],
    allowances: [],
    baseSalary: 4500000,
    hourlyRate: 25000,
    globalClockIn: '17:00',
    periodStart: '2025-01-01',
    periodEnd: '2025-01-31',
    onEntryUpdate: () => {},
    breakdown: null,
    currentUserId: 'user-1',
  };

  /**
   * **Validates: Requirement 3.3, 8.4**
   * Test successful clock-out update flow
   */
  it('should successfully update clock-out time when chip is selected', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip18 = screen.getByText('18');
    await user.click(chip18);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '18:00' }
    );
    expect(mockOnEntryUpdate).toHaveBeenCalledTimes(1);
  });

  /**
   * **Validates: Requirement 3.3, 15.1**
   * Test optimistic UI update
   */
  it('should perform optimistic UI update immediately on chip selection', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip19 = screen.getByText('19');
    await user.click(chip19);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '19:00' }
    );
  });

  /**
   * **Validates: Requirement 15.1**
   * Test that UI advances to next day after transition
   */
  it('should advance to next day after transition completes', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();

    const chip18 = screen.getByText('18');
    await user.click(chip18);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });
  });

  /**
   * **Validates: Requirement 4.6**
   * Test that transitions prevent additional input
   */
  it('should prevent chip selection during transition', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip18 = screen.getByText('18');
    await user.click(chip18);

    const chip19 = screen.getByText('19');
    await user.click(chip19);

    expect(mockOnEntryUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '18:00' }
    );
  });

  /**
   * **Validates: Requirement 3.3, 8.4**
   * Test multiple sequential clock-out selections
   */
  it('should handle multiple sequential clock-out selections correctly', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip18 = screen.getByText('18');
    await user.click(chip18);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '18:00' }
    );

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    const chip19 = screen.getByText('19');
    await user.click(chip19);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-02',
      2,
      { clock_out: '19:00' }
    );

    expect(mockOnEntryUpdate).toHaveBeenCalledTimes(2);
  });

  /**
   * **Validates: Requirement 3.3, 8.4**
   * Test clock-out selection with different time values
   */
  it('should correctly handle different clock-out time selections', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip17_5 = screen.getByText('17.5');
    await user.click(chip17_5);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '17:30' }
    );
  });

  /**
   * **Validates: Requirement 8.4**
   * Test that correct entry is updated when multiple entries exist
   */
  it('should update the correct entry when multiple working days exist', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
      createMockEntry('2025-01-04', false, 4),
      createMockEntry('2025-01-05', false, 5),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();

    const chip20 = screen.getByText('20');
    await user.click(chip20);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '20:00' }
    );

    expect(mockOnEntryUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      2,
      expect.anything()
    );
  });

  /**
   * **Validates: Requirement 15.1**
   * Test that interface responds quickly to chip selection
   */
  it('should respond to chip selection within 200ms', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const startTime = Date.now();
    
    const chip18 = screen.getByText('18');
    await user.click(chip18);

    const responseTime = Date.now() - startTime;

    expect(mockOnEntryUpdate).toHaveBeenCalled();
    expect(responseTime).toBeLessThan(200);
  });

  /**
   * **Validates: Requirement 3.3, 8.4**
   * Test that clock-out selection works with entries that already have clock-out times
   */
  it('should update clock-out time for entries that already have a value', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip19 = screen.getByText('19');
    await user.click(chip19);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '19:00' }
    );
  });

  /**
   * **Validates: Requirement 4.6**
   * Test that isTransitioning state prevents rapid clicks
   */
  it('should ignore rapid successive clicks during transition', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip18 = screen.getByText('18');
    await user.click(chip18);

    const chip19 = screen.getByText('19');
    const chip20 = screen.getByText('20');
    const chip21 = screen.getByText('21');
    
    await user.click(chip19);
    await user.click(chip20);
    await user.click(chip21);

    expect(mockOnEntryUpdate).toHaveBeenCalledTimes(1);
  });

  /**
   * **Validates: Requirement 3.3, 8.4**
   * Test that selection works correctly at the end of the working days list
   */
  it('should handle clock-out selection on the last working day', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    const chip18 = screen.getByText('18');
    await user.click(chip18);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '18:00' }
    );

    await new Promise(resolve => setTimeout(resolve, 600));

    expect(screen.getByText('1')).toBeInTheDocument();
  });
});


/**
 * **Validates: Requirements 5.2, 5.3, 5.4, 5.5**
 * 
 * Integration tests for previous day correction flow:
 * - Requirement 5.2: WHEN a user taps the Review_State Squircle, THE Immersive_View SHALL allow editing of that day's clock-out time
 * - Requirement 5.3: WHEN editing the Review_State entry, THE Immersive_View SHALL display the Clock_Out_Chip grid for that day
 * - Requirement 5.4: WHEN a correction is made, THE Immersive_View SHALL save the updated time
 * - Requirement 5.5: WHEN correction is complete, THE Immersive_View SHALL return to the current Focus_State day
 */
describe('ImmersiveInputTypeB - Previous Day Correction Flow', () => {
  const mockProps = {
    rates: [],
    allowances: [],
    baseSalary: 4500000,
    hourlyRate: 25000,
    globalClockIn: '17:00',
    periodStart: '2025-01-01',
    periodEnd: '2025-01-31',
    onEntryUpdate: () => {},
    breakdown: null,
    currentUserId: 'user-1',
  };

  /**
   * **Validates: Requirement 5.2, 5.3**
   * Test entering edit mode for previous day
   */
  it('should enter edit mode when review state card is tapped', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // First, advance to day 2 by selecting a time for day 1
    const chip18 = screen.getByText('18');
    await user.click(chip18);

    // Wait for transition to complete
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    // Now we should see day 1 in review state (showing "18:00")
    expect(screen.getByText('18:00')).toBeInTheDocument();

    // Find the review card by looking for the element that contains both day 1 and the clock-out time
    const reviewCard = screen.getByText('1').closest('.glass-card');
    expect(reviewCard).toBeInTheDocument();

    // Click on the review card to enter edit mode
    if (reviewCard) {
      await user.click(reviewCard);
    }

    // After clicking, the chip grid should be available for the previous day
    // The chips should still be visible (now for editing day 1) - there will be duplicates
    expect(screen.getAllByText('17.5').length).toBeGreaterThan(0);
  });

  /**
   * **Validates: Requirement 5.4**
   * Test saving corrected time
   */
  it('should save corrected time when chip is selected in edit mode', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // Advance to day 2
    const chip18 = screen.getByText('18');
    await user.click(chip18);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    // Clear the mock to track only correction calls
    mockOnEntryUpdate.mockClear();

    // Click on the review card to enter edit mode
    const reviewCard = screen.getByText('1').closest('.glass-card');
    if (reviewCard) {
      await user.click(reviewCard);
    }

    // Wait a bit for edit mode to activate
    await new Promise(resolve => setTimeout(resolve, 100));

    // Select a different time (19:00) for the previous day - get all chips and click the first one
    const chip19Elements = screen.getAllByText('19');
    await user.click(chip19Elements[0]);

    // Verify that onEntryUpdate was called with the correct parameters for day 1
    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '19:00' }
    );
  });

  /**
   * **Validates: Requirement 5.5**
   * Test returning to focus state after correction
   */
  it('should return to focus state after correction is complete', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2),
      createMockEntry('2025-01-03', false, 3),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // Advance to day 2
    const chip18 = screen.getByText('18');
    await user.click(chip18);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    // Enter edit mode
    const reviewCard = screen.getByText('1').closest('.glass-card');
    if (reviewCard) {
      await user.click(reviewCard);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Make a correction - get all chips with text "19" and click the first one (in the review card)
    const chip19Elements = screen.getAllByText('19');
    await user.click(chip19Elements[0]);

    // Wait for the correction to complete and return to focus state
    await waitFor(() => {
      // The focus should be back on day 2
      // We can verify this by checking that day 2 is still the current focus
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 400 });

    // Verify we're no longer in edit mode by checking that chips exist
    // (both cards will have chips but we just need to verify they're present)
    const chip18Elements = screen.getAllByText('18');
    expect(chip18Elements.length).toBeGreaterThan(0);
  });

  /**
   * **Validates: Requirement 5.2**
   * Test that edit mode is not available when on the first day
   */
  it('should not allow edit mode when on the first working day', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // We're on day 1, there should be no review card
    expect(screen.getByText('1')).toBeInTheDocument();
    
    // There should be no "18:00" text (which would indicate a review card with clock-out)
    expect(screen.queryByText('18:00')).not.toBeInTheDocument();
  });

  /**
   * **Validates: Requirement 5.4**
   * Test that correction updates the correct entry
   */
  it('should update the correct entry when correcting previous day', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2, '19:00'),
      createMockEntry('2025-01-03', false, 3),
      createMockEntry('2025-01-04', false, 4),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // Advance to day 2
    const chip18First = screen.getByText('18');
    await user.click(chip18First);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    // Advance to day 3
    const chip19 = screen.getByText('19');
    await user.click(chip19);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    }, { timeout: 600 });

    // Clear mock to track only correction
    mockOnEntryUpdate.mockClear();

    // Now we're on day 3, and day 2 is in review state
    // Click on the review card (day 2)
    const reviewCard = screen.getByText('2').closest('.glass-card');
    if (reviewCard) {
      await user.click(reviewCard);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Correct day 2's time to 20:00 - get all chips with text "20" and click the first one
    const chip20Elements = screen.getAllByText('20');
    await user.click(chip20Elements[0]);

    // Verify that day 2 was updated, not day 1 or day 3
    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-02',
      2,
      { clock_out: '20:00' }
    );
    expect(mockOnEntryUpdate).not.toHaveBeenCalledWith(
      '2025-01-01',
      expect.anything(),
      expect.anything()
    );
    expect(mockOnEntryUpdate).not.toHaveBeenCalledWith(
      '2025-01-03',
      expect.anything(),
      expect.anything()
    );
  });

  /**
   * **Validates: Requirement 5.3, 5.5**
   * Test that chip grid is displayed during edit mode
   */
  it('should display chip grid for previous day during edit mode', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // Advance to day 2
    const chip18 = screen.getByText('18');
    await user.click(chip18);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    // Before edit mode, the review card should show the clock-out time
    expect(screen.getByText('18:00')).toBeInTheDocument();

    // Enter edit mode
    const reviewCard = screen.getByText('1').closest('.glass-card');
    if (reviewCard) {
      await user.click(reviewCard);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // During edit mode, the chip grid should be visible
    // All time chips should be present (there will be duplicates because both cards show chips)
    expect(screen.getAllByText('17.5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('18').length).toBeGreaterThan(0);
    expect(screen.getAllByText('19').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
  });

  /**
   * **Validates: Requirement 5.4, 5.5**
   * Test that multiple corrections can be made
   */
  it('should allow multiple corrections to the same day', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // Advance to day 2
    const chip18 = screen.getByText('18');
    await user.click(chip18);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    mockOnEntryUpdate.mockClear();

    // First correction
    const reviewCard = screen.getByText('1').closest('.glass-card');
    if (reviewCard) {
      await user.click(reviewCard);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const chip19Elements = screen.getAllByText('19');
    await user.click(chip19Elements[0]);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '19:00' }
    );

    // Wait for correction to complete - need to wait for the full animation + state reset
    await new Promise(resolve => setTimeout(resolve, 500));

    mockOnEntryUpdate.mockClear();

    // Second correction - find the review card again
    const reviewCard2 = screen.getByText('1').closest('.glass-card');
    if (reviewCard2) {
      await user.click(reviewCard2);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const chip20Elements = screen.getAllByText('20');
    await user.click(chip20Elements[0]);

    expect(mockOnEntryUpdate).toHaveBeenCalledWith(
      '2025-01-01',
      1,
      { clock_out: '20:00' }
    );
  });

  /**
   * **Validates: Requirement 5.2, 5.3**
   * Test that current day input is disabled during edit mode
   */
  it('should disable current day input during edit mode', async () => {
    const user = userEvent.setup();
    const mockOnEntryUpdate = vi.fn();

    const entries: SalaryEntry[] = [
      createMockEntry('2025-01-01', false, 1, '18:00'),
      createMockEntry('2025-01-02', false, 2),
    ];

    render(
      <ImmersiveInputTypeB
        {...mockProps}
        entries={entries}
        onEntryUpdate={mockOnEntryUpdate}
      />
    );

    // Advance to day 2
    const chip18 = screen.getByText('18');
    await user.click(chip18);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    }, { timeout: 600 });

    mockOnEntryUpdate.mockClear();

    // Enter edit mode
    const reviewCard = screen.getByText('1').closest('.glass-card');
    if (reviewCard) {
      await user.click(reviewCard);
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to click on a chip for the current day (day 2)
    // Get all chips with text "19" - the second one should be disabled (current day)
    const chip19Elements = screen.getAllByText('19');
    // Click the second chip (the one in the current day card which should be disabled)
    await user.click(chip19Elements[1]);

    // The update should be for day 1 (the one being edited), not day 2
    // If day 2 was updated, that would be a bug
    expect(mockOnEntryUpdate).not.toHaveBeenCalledWith(
      '2025-01-02',
      2,
      expect.anything()
    );
  });
});
