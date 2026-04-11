import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BottomNav } from '@/components/bottom-nav';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/discover'),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe('BottomNav', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders 4 items for crew hat', () => {
    render(<BottomNav currentHat="crew" identityType="crew" />);

    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Docky')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.queryByText('Post Job')).not.toBeInTheDocument();
    expect(screen.queryByText('My Jobs')).not.toBeInTheDocument();
  });

  it('renders 4 items for employer hat', () => {
    render(<BottomNav currentHat="employer" identityType="crew" />);

    expect(screen.getByText('Post Job')).toBeInTheDocument();
    expect(screen.getByText('My Jobs')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.queryByText('Opportunities')).not.toBeInTheDocument();
  });

  it('renders 4 items for agent hat (same as employer)', () => {
    render(<BottomNav currentHat="agent" identityType="agent" />);

    expect(screen.getByText('Post Job')).toBeInTheDocument();
    expect(screen.getByText('My Jobs')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('applies active styling to the current route', () => {
    render(<BottomNav currentHat="crew" identityType="crew" />);

    const discoverLink = screen.getByText('Opportunities').closest('a');
    expect(discoverLink?.className).toContain('font-medium');
    expect(discoverLink?.className).toContain('text-[var(--accent)]');

    const messagesLink = screen.getByText('Messages').closest('a');
    expect(messagesLink?.className).toContain('text-[var(--muted-foreground)]');
  });
});
