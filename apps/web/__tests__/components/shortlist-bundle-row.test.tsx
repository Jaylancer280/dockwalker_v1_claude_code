import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShortlistBundleRow } from '@/app/(app)/messages/_components/shortlist-bundle-row';

afterEach(cleanup);

const baseProps = {
  postingId: 'posting-1',
  roleName: 'Deckhand',
  vesselName: 'M/Y Serenity',
  portName: 'Antibes',
  childCount: 3,
  hasUnread: false,
  unreadCount: 0,
  lastActivity: '2026-05-01T10:00:00Z',
  prefersReducedMotion: true,
  children: <div data-testid="child-row">child</div>,
};

describe('ShortlistBundleRow', () => {
  it('renders parent row with role + vessel + count', () => {
    render(<ShortlistBundleRow {...baseProps} />);
    expect(screen.getByText(/Deckhand · M\/Y Serenity/)).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('Antibes')).toBeDefined();
  });

  it('starts collapsed — children not visible on initial render', () => {
    render(<ShortlistBundleRow {...baseProps} />);
    expect(screen.queryByTestId('child-row')).toBeNull();
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands on click — children visible after toggle', () => {
    render(<ShortlistBundleRow {...baseProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('child-row')).toBeDefined();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses again on second click', () => {
    render(<ShortlistBundleRow {...baseProps} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders count = 1 (singleton bundle still bundles per spec)', () => {
    render(<ShortlistBundleRow {...baseProps} childCount={1} />);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('shows unread count when hasUnread is true', () => {
    render(
      <ShortlistBundleRow {...baseProps} childCount={5} hasUnread={true} unreadCount={2} />,
    );
    expect(screen.getByText('2 of 5')).toBeDefined();
  });

  it('falls back to "Permanent role" / "Vessel TBC" when names are null', () => {
    render(
      <ShortlistBundleRow {...baseProps} roleName={null} vesselName={null} portName={null} />,
    );
    expect(screen.getByText(/Permanent role · Vessel TBC/)).toBeDefined();
  });
});
