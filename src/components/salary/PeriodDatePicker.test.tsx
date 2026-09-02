import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PeriodDatePicker from './PeriodDatePicker';

const defaultProps = {
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  rates: [],
  entries: [],
  onSelect: vi.fn(),
  onClose: vi.fn(),
};

function dayButton(iso: string) {
  return screen.getByTitle(new RegExp(`^${iso}\\b`));
}

function pointerOpts() {
  return { button: 0, buttons: 1, clientX: 10, clientY: 10, pointerType: 'touch' };
}

function holdDate(iso: string) {
  const btn = dayButton(iso);
  fireEvent.pointerDown(btn, pointerOpts());
  act(() => {
    vi.advanceTimersByTime(500);
  });
  fireEvent.pointerUp(btn, pointerOpts());
  fireEvent.click(btn);
}

function tapDate(iso: string) {
  const btn = dayButton(iso);
  fireEvent.pointerDown(btn, pointerOpts());
  fireEvent.pointerUp(btn, pointerOpts());
  fireEvent.click(btn);
}

describe('PeriodDatePicker range add', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { ...navigator, vibrate: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('adds a single day on a regular tap', () => {
    const onSelect = vi.fn();
    render(<PeriodDatePicker {...defaultProps} onSelect={onSelect} />);

    tapDate('2026-08-03');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('2026-08-03');
  });

  it('adds every day from the long-pressed start through the next tap', () => {
    const onSelect = vi.fn();
    render(<PeriodDatePicker {...defaultProps} onSelect={onSelect} />);

    holdDate('2026-08-03');
    expect(screen.getByText(/chạm ngày kết thúc/)).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    tapDate('2026-08-06');

    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ]);
  });

  it('fills the range in either direction', () => {
    const onSelect = vi.fn();
    render(<PeriodDatePicker {...defaultProps} onSelect={onSelect} />);

    holdDate('2026-08-06');
    tapDate('2026-08-03');

    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ]);
  });
});
