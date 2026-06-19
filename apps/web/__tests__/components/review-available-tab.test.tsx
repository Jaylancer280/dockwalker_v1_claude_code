import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockUseParams = vi.fn(() => ({ id: 'd1' }));
const mockUseRouter = vi.fn(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useRouter: () => mockUseRouter(),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), toasts: [], dismiss: vi.fn() }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
      style: _style,
      ...props
    }: {
      children?: React.ReactNode;
      className?: string;
      style?: Record<string, unknown>;
      [key: string]: unknown;
    }) => {
      const safeProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (k.startsWith('on') || k === 'id' || k === 'role' || k === 'title') {
          safeProps[k] = v;
        }
      }
      return (
        <div className={className} {...safeProps}>
          {children}
        </div>
      );
    },
  },
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useTransform: () => ({ get: () => 0 }),
  animate: vi.fn(),
}));

// Mock haptics
vi.mock('@/lib/haptics', () => ({
  hapticMedium: vi.fn(),
  hapticLight: vi.fn(),
}));

// Mock supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [] }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { current_hat: 'employer' } }),
        }),
      }),
    }),
  }),
}));

// Mock my-jobs-tab
vi.mock('@/lib/my-jobs-tab', () => ({
  MY_JOBS_TAB_STORAGE_KEY: 'my-jobs-tab',
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import ReviewApplicantsPage from '@/app/(app)/daywork/[id]/review/page';

describe('Review Page — Available Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: applicants API returns empty
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ applicants: [] }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders three tabs with correct labels', async () => {
    render(<ReviewApplicantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Applicants')).toBeInTheDocument();
      expect(screen.getByText('Shortlist')).toBeInTheDocument();
      expect(screen.getByText(/Available/)).toBeInTheDocument();
    });
  });

  it('available tab shows invite/pass buttons when crew are loaded', async () => {
    // First call: applicants API (initial load)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ applicants: [] }),
    });

    render(<ReviewApplicantsPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Available/)).toBeInTheDocument();
    });

    // Mock available crew response for when tab is clicked
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        crew: [
          {
            person_id: 'c1',
            display_name: 'Test Crew',
            primary_role_id: 'r1',
            certification_ids: [],
            vessel_size_exposure_ids: [],
            bio: null,
            available_days: 3,
            yacht_roles: { name: 'Deckhand', department: 'Deck' },
            experience_brackets: { label: '2-5 years' },
            ports: null,
          },
        ],
        invitation_count: 1,
        invitation_limit: 2,
      }),
    });

    // Click Available tab
    screen.getByText(/Available/).click();

    await waitFor(() => {
      expect(screen.getByText('Test Crew')).toBeInTheDocument();
    });

    // Check for invitation indicator
    expect(screen.getByText('1 of 2 invitations used')).toBeInTheDocument();
  });

  it('shows invitation limit reached message when all invitations used', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ applicants: [] }),
    });

    render(<ReviewApplicantsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Available/)).toBeInTheDocument();
    });

    // Return empty crew with limit reached
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        crew: [],
        invitation_count: 2,
        invitation_limit: 2,
      }),
    });

    screen.getByText(/Available/).click();

    await waitFor(() => {
      expect(screen.getByText('Invitation limit reached')).toBeInTheDocument();
    });
  });
});
