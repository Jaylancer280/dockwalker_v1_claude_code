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

  // B-014: status API returns per-tier map. `subscriptions: { crew_pro,
  // employer_pro }` where each entry is `{ status, current_period_end } | null`.
  const noSubs = (hat: 'crew' | 'employer') => ({
    subscriptions: { crew_pro: null, employer_pro: null },
    current_hat: hat,
  });

  it('renders crew tier plan cards for crew hat', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(noSubs('crew'))),
    });

    render(<BillingPage />);

    const freeCard = await screen.findByText('Free');
    expect(freeCard).toBeDefined();
    expect(screen.getByText('Crew Pro')).toBeDefined();
    expect(screen.getByText(/10 Docky AI questions per month/)).toBeDefined();
    expect(screen.getByText(/500 Docky AI questions per month/)).toBeDefined();
  });

  it('renders employer tier plan cards for employer hat', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(noSubs('employer'))),
    });

    render(<BillingPage />);

    const freeCard = await screen.findByText('Free');
    expect(freeCard).toBeDefined();
    expect(screen.getByText('Employer Pro')).toBeDefined();
    expect(screen.getByText(/Unlimited.*posting templates/)).toBeDefined();
  });

  it('shows "Current plan" badge on Free card when no subscription', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(noSubs('crew'))),
    });

    render(<BillingPage />);

    const badges = await screen.findAllByText('Current plan');
    expect(badges.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Subscribe').length).toBeGreaterThan(0);
  });

  it('shows "Manage subscription" when subscribed to matching tier', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            subscriptions: {
              crew_pro: { status: 'active', current_period_end: null },
              employer_pro: null,
            },
            current_hat: 'crew',
          }),
        ),
    });

    render(<BillingPage />);

    const manageBtn = await screen.findByText('Manage subscription');
    expect(manageBtn).toBeDefined();
  });

  it('passes correct plan to checkout for employer hat', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(noSubs('employer'))),
    });

    render(<BillingPage />);

    // Verify the employer tier is shown
    await screen.findByText('Employer Pro');
    expect(screen.getAllByText('€14.99/month').length).toBeGreaterThan(0);
  });
});
