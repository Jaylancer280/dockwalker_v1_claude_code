import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ExperienceBracketPills } from '@/components/experience-bracket-pills';

const brackets = [
  { id: 'b1', name: 'Green' },
  { id: 'b2', name: '1-2 years' },
  { id: 'b3', name: '3-5 years' },
];

describe('ExperienceBracketPills', () => {
  afterEach(cleanup);

  it('renders all brackets as pills', () => {
    render(<ExperienceBracketPills brackets={brackets} value="" onValueChange={vi.fn()} />);
    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText('1-2 years')).toBeInTheDocument();
    expect(screen.getByText('3-5 years')).toBeInTheDocument();
  });

  it('highlights the selected bracket', () => {
    render(<ExperienceBracketPills brackets={brackets} value="b2" onValueChange={vi.fn()} />);
    const selected = screen.getByText('1-2 years');
    expect(selected.className).toContain('bg-[var(--accent)]');
  });

  it('calls onValueChange when a pill is clicked', () => {
    const onChange = vi.fn();
    render(<ExperienceBracketPills brackets={brackets} value="" onValueChange={onChange} />);
    fireEvent.click(screen.getByText('3-5 years'));
    expect(onChange).toHaveBeenCalledWith('b3');
  });

  it('shows "Any" pill when optional is true', () => {
    render(
      <ExperienceBracketPills brackets={brackets} value="" onValueChange={vi.fn()} optional />,
    );
    expect(screen.getByText('Any')).toBeInTheDocument();
  });

  it('"Any" pill maps to empty string', () => {
    const onChange = vi.fn();
    render(
      <ExperienceBracketPills brackets={brackets} value="b1" onValueChange={onChange} optional />,
    );
    fireEvent.click(screen.getByText('Any'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not show "Any" when optional is false', () => {
    render(<ExperienceBracketPills brackets={brackets} value="" onValueChange={vi.fn()} />);
    expect(screen.queryByText('Any')).not.toBeInTheDocument();
  });
});
