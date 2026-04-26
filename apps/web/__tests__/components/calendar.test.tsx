import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Calendar } from '@/components/ui/calendar';

afterEach(cleanup);

describe('<Calendar>', () => {
  it('renders the value\'s month and highlights the selected day', () => {
    render(<Calendar value="2026-04-15" onSelect={() => {}} />);
    expect(screen.getByText(/April 2026/i)).toBeTruthy();
    const fifteen = screen.getByRole('button', { name: '15' });
    expect(fifteen.getAttribute('aria-pressed')).toBe('true');
  });

  it('falls back to defaultMonth or today when value is empty', () => {
    render(<Calendar value="" onSelect={() => {}} defaultMonth="2030-12-01" />);
    expect(screen.getByText(/December 2030/i)).toBeTruthy();
  });

  it('fires onSelect with the clicked ISO day', () => {
    const onSelect = vi.fn();
    render(<Calendar value="2026-04-15" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    expect(onSelect).toHaveBeenCalledWith('2026-04-20');
  });

  it('disables days outside the [min, max] window', () => {
    render(<Calendar value="2026-04-15" onSelect={() => {}} min="2026-04-10" max="2026-04-20" />);
    expect(screen.getByRole('button', { name: '5' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '15' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: '25' }).hasAttribute('disabled')).toBe(true);
  });

  it('navigates to the previous and next month', () => {
    render(<Calendar value="2026-04-15" onSelect={() => {}} />);
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getByText(/March 2026/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Next month'));
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByText(/May 2026/i)).toBeTruthy();
  });

  it('updates the visible month when the value prop jumps to a different month', () => {
    const { rerender } = render(<Calendar value="2026-04-15" onSelect={() => {}} />);
    expect(screen.getByText(/April 2026/i)).toBeTruthy();
    rerender(<Calendar value="2026-09-03" onSelect={() => {}} />);
    expect(screen.getByText(/September 2026/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true');
  });
});
