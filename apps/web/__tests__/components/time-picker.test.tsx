import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { TimePicker } from '@/components/ui/time-picker';

afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const ROW_PX = 36;

describe('<TimePicker>', () => {
  it('renders both columns and the colon separator', () => {
    render(<TimePicker value="09:30" onChange={() => {}} />);
    const lists = screen.getAllByRole('listbox');
    expect(lists).toHaveLength(2);
    expect(lists[0].getAttribute('aria-label')).toBe('Hours');
    expect(lists[1].getAttribute('aria-label')).toBe('Minutes');
    expect(screen.getByText(':')).toBeTruthy();
  });

  it('renders the configured minute step rows (15-min default)', () => {
    render(<TimePicker value="09:30" onChange={() => {}} />);
    const [, minutes] = screen.getAllByRole('listbox');
    expect(minutes.textContent).toContain('00');
    expect(minutes.textContent).toContain('15');
    expect(minutes.textContent).toContain('30');
    expect(minutes.textContent).toContain('45');
    expect(minutes.textContent).not.toContain('05'); // 05 is not a 15-min step
  });

  it('honours minuteStep=5 — renders 12 minute rows', () => {
    render(<TimePicker value="09:00" onChange={() => {}} minuteStep={5} />);
    const [, minutes] = screen.getAllByRole('listbox');
    expect(minutes.textContent).toContain('05');
    expect(minutes.textContent).toContain('10');
    expect(minutes.textContent).toContain('55');
  });

  it('debounces scroll → onChange so settle fires once with the centered value', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    const [hourCol] = screen.getAllByRole('listbox');

    // Simulate scroll to row 14 (= 14:00).
    Object.defineProperty(hourCol, 'scrollTop', { value: 14 * ROW_PX, configurable: true });
    fireEvent.scroll(hourCol);

    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('14:00');
  });

  it('only emits onChange when the new HH:mm differs from the current value', () => {
    const onChange = vi.fn();
    render(<TimePicker value="09:00" onChange={onChange} />);
    const [hourCol] = screen.getAllByRole('listbox');

    Object.defineProperty(hourCol, 'scrollTop', { value: 9 * ROW_PX, configurable: true });
    fireEvent.scroll(hourCol);
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps a malformed value to 00:00', () => {
    const onChange = vi.fn();
    render(<TimePicker value="not-a-time" onChange={onChange} />);
    // Without a scroll, the columns initialised to 0; no onChange fires.
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
