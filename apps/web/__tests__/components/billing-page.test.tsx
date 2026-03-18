import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchMock = vi.fn() as any;
globalThis.fetch = fetchMock;

import BillingPage from '@/app/(app)/billing/page';

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plan cards with feature lists', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ plan: null, status: null })),
    });

    render(<BillingPage />);

    // Wait for loading to finish
    const freeCard = await screen.findByText('Free');
    expect(freeCard).toBeDefined();
    expect(screen.getByText('Crew Pro')).toBeDefined();
    expect(screen.getByText('3 questions/month')).toBeDefined();
    expect(screen.getByText('Unlimited questions')).toBeDefined();
  });

  it('shows "Current plan" badge on Free card when no subscription', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ plan: null, status: null })),
    });

    render(<BillingPage />);

    const badge = await screen.findByText('Current plan');
    expect(badge).toBeDefined();
    // Subscribe button should be visible
    expect(screen.getAllByText('Subscribe').length).toBeGreaterThan(0);
  });

  it('shows "Manage subscription" when subscribed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ plan: 'crew_pro', status: 'active' })),
    });

    render(<BillingPage />);

    const manageBtn = await screen.findByText('Manage subscription');
    expect(manageBtn).toBeDefined();
  });
});
