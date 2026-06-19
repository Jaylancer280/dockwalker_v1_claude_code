import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    toasts: [],
    dismiss: vi.fn(),
  }),
}));

const mockSafeFetch = vi.fn();
vi.mock('@/lib/safe-fetch', () => ({
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args),
}));

// Default state: CV Builder is locked. Individual tests that exercise
// the unlocked toggle behaviour (re-introduced when Stage 2 ships) can
// override this via vi.mocked or a per-test mock — but the default
// covers the locked production state.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: false,
}));

import CvBuilderSettingsPage from '@/app/(app)/settings/cv/page';

function profileResponse(hat: string, seaTime = false) {
  return {
    ok: true,
    data: {
      person: { id: 'u1', identity_type: 'crew', current_hat: hat },
      profile: {
        cv_include_sea_time: seaTime,
        cv_handle: null,
        cv_generated_at: null,
      },
    },
  };
}

function refsResponse(refs: unknown[]) {
  return { ok: true, data: { outbound: refs } };
}

function expsResponse(exps: unknown[]) {
  return { ok: true, data: { experiences: exps } };
}

describe('CV Builder settings page', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('renders Coming-Soon banner + locked Generate CV button', async () => {
    mockSafeFetch
      .mockResolvedValueOnce(profileResponse('crew'))
      .mockResolvedValueOnce(refsResponse([]))
      .mockResolvedValueOnce(expsResponse([]));

    render(<CvBuilderSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText(/DockWalker CV — Coming Soon/)).toBeInTheDocument();
    });
    const generateBtn = screen.getByRole('button', { name: /Generate CV — coming soon/i });
    expect(generateBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('locked Generate button fires Coming-Soon toast and does NOT call /api/cv/generate', async () => {
    mockSafeFetch
      .mockResolvedValueOnce(profileResponse('crew'))
      .mockResolvedValueOnce(refsResponse([]))
      .mockResolvedValueOnce(expsResponse([]));

    render(<CvBuilderSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText(/DockWalker CV — Coming Soon/)).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /Generate CV — coming soon/i });
    fireEvent.click(generateBtn);

    expect(mockShowSuccess).toHaveBeenCalledWith('DockWalker CV — Coming Soon');
    // Initial 3 fetches (profile, refs, experiences) but no /api/cv/generate
    const generateCalls = mockSafeFetch.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('/api/cv/generate'),
    );
    expect(generateCalls).toHaveLength(0);
  });

  it('redirects agent hat to /settings (out of scope per spec §12 v2-deferred)', async () => {
    mockSafeFetch
      .mockResolvedValueOnce(profileResponse('agent'))
      .mockResolvedValueOnce(refsResponse([]))
      .mockResolvedValueOnce(expsResponse([]));

    render(<CvBuilderSettingsPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/settings');
    });
  });

  it('clicking the sea-time toggle while locked fires Coming-Soon toast and does NOT call /api/cv/settings', async () => {
    mockSafeFetch
      .mockResolvedValueOnce(profileResponse('crew', false))
      .mockResolvedValueOnce(refsResponse([]))
      .mockResolvedValueOnce(expsResponse([]));

    render(<CvBuilderSettingsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Include sea time totals on my CV/i)).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText(/Include sea time totals on my CV/i);
    fireEvent.click(toggle);

    expect(mockShowSuccess).toHaveBeenCalledWith('DockWalker CV — Coming Soon');
    // No PATCH happened — only the initial 3 fetches (profile, refs, experiences).
    const patchCall = mockSafeFetch.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0] === '/api/cv/settings' &&
        (c[1] as { method?: string })?.method === 'PATCH',
    );
    expect(patchCall).toBeUndefined();
  });

  it('renders accepted references with per-row Include-on-CV toggles', async () => {
    mockSafeFetch
      .mockResolvedValueOnce(profileResponse('crew'))
      .mockResolvedValueOnce(
        refsResponse([
          {
            id: 'ref-1',
            status: 'accepted',
            claimed_referee_name: 'Captain Smith',
            claimed_referee_role: 'Captain',
            snapshot_vessel_name: 'M/Y Serenity',
            snapshot_start_date: '2024-01-01',
            snapshot_end_date: '2024-12-31',
            include_on_cv: false,
          },
          {
            id: 'ref-2',
            status: 'pending', // should be filtered out
            claimed_referee_name: 'Captain Other',
            claimed_referee_role: 'Captain',
            snapshot_vessel_name: 'M/Y Other',
            snapshot_start_date: '2023-01-01',
            snapshot_end_date: null,
            include_on_cv: false,
          },
        ]),
      )
      .mockResolvedValueOnce(expsResponse([]));

    render(<CvBuilderSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Captain Smith')).toBeInTheDocument();
    });
    expect(screen.queryByText('Captain Other')).not.toBeInTheDocument();
  });

  it('requests NDA-filtered experiences from the server and renders them', async () => {
    mockSafeFetch
      .mockResolvedValueOnce(profileResponse('crew'))
      .mockResolvedValueOnce(refsResponse([]))
      .mockResolvedValueOnce(
        // Server-side filter (audit P1-P5) — the API returns only NDA-flagged
        // rows when called with ?nda_only=true. The page no longer filters
        // client-side; it trusts the filtered response.
        expsResponse([
          {
            id: 'exp-nda',
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            is_current: false,
            cv_show_full_vessel: true,
            vessels: { id: 'v1', name: 'M/Y NDA Boat', nda_flag: true },
            yacht_roles: { name: 'Bosun' },
          },
        ]),
      );

    render(<CvBuilderSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('M/Y NDA Boat')).toBeInTheDocument();
    });
    // Page must pass nda_only=true to the API so the server filters at the
    // SQL layer and skips historical-name resolution.
    const expsFetchCall = mockSafeFetch.mock.calls.find((c) =>
      String(c[0]).includes('/api/experiences'),
    );
    expect(expsFetchCall?.[0]).toContain('nda_only=true');
  });
});
