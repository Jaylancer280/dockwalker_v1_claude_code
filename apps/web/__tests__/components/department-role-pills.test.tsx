import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DepartmentRolePills } from '@/components/department-role-pills';

const roles = [
  { id: 'r1', name: 'Deckhand', department: 'deck' },
  { id: 'r2', name: 'Bosun', department: 'deck' },
  { id: 'r3', name: 'Chief Stewardess', department: 'interior' },
  { id: 'r4', name: 'Engineer', department: 'engineering' },
  { id: 'r5', name: 'Deck/Engineer', department: 'deck_engineering' },
];

describe('DepartmentRolePills', () => {
  afterEach(cleanup);

  it('renders department headers', () => {
    render(<DepartmentRolePills roles={roles} value="" onValueChange={vi.fn()} />);
    expect(screen.getByText(/deck/i)).toBeInTheDocument();
    expect(screen.getByText(/interior/i)).toBeInTheDocument();
    expect(screen.getByText(/engineering/i)).toBeInTheDocument();
  });

  it('departments are collapsed by default when no value selected', () => {
    render(<DepartmentRolePills roles={roles} value="" onValueChange={vi.fn()} />);
    // Roles should not be visible when collapsed
    expect(screen.queryByText('Deckhand')).not.toBeInTheDocument();
  });

  it('expands department on click and shows roles', () => {
    render(<DepartmentRolePills roles={roles} value="" onValueChange={vi.fn()} />);
    // Click the deck department header
    const deptButtons = screen.getAllByRole('button');
    const deckBtn = deptButtons.find((b) => b.textContent?.toLowerCase().includes('deck'));
    expect(deckBtn).toBeDefined();
    fireEvent.click(deckBtn!);
    expect(screen.getByText('Deckhand')).toBeInTheDocument();
    expect(screen.getByText('Bosun')).toBeInTheDocument();
  });

  it('calls onValueChange when a role pill is clicked', () => {
    const onChange = vi.fn();
    render(<DepartmentRolePills roles={roles} value="" onValueChange={onChange} />);
    // Expand deck
    const deptButtons = screen.getAllByRole('button');
    const deckBtn = deptButtons.find((b) => b.textContent?.toLowerCase().includes('deck'));
    fireEvent.click(deckBtn!);
    // Click Bosun
    fireEvent.click(screen.getByText('Bosun'));
    expect(onChange).toHaveBeenCalledWith('r2');
  });

  it('search filters roles and auto-expands matching departments', () => {
    render(<DepartmentRolePills roles={roles} value="" onValueChange={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/search roles/i);
    fireEvent.change(searchInput, { target: { value: 'stew' } });
    // Interior department should be visible with Chief Stewardess
    expect(screen.getByText('Chief Stewardess')).toBeInTheDocument();
    // Deck roles should not be visible
    expect(screen.queryByText('Deckhand')).not.toBeInTheDocument();
  });

  it('auto-expands department of selected role', () => {
    render(<DepartmentRolePills roles={roles} value="r3" onValueChange={vi.fn()} />);
    // Interior department should be expanded since r3 (Chief Stewardess) is selected
    // Appears twice: once in the selected role preview, once as the pill button
    const matches = screen.getAllByText('Chief Stewardess');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('hybrid roles appear under both parent departments', () => {
    render(<DepartmentRolePills roles={roles} value="" onValueChange={vi.fn()} />);
    // Expand deck
    const deptButtons = screen.getAllByRole('button');
    const deckBtn = deptButtons.find((b) => b.textContent?.toLowerCase().includes('deck'));
    fireEvent.click(deckBtn!);
    expect(screen.getByText('Deck/Engineer')).toBeInTheDocument();

    // Expand engineering
    const engBtn = deptButtons.find((b) => b.textContent?.toLowerCase().includes('engineering'));
    fireEvent.click(engBtn!);
    // Deck/Engineer should appear here too
    const deckEngPills = screen.getAllByText('Deck/Engineer');
    expect(deckEngPills.length).toBe(2);
  });
});
