import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';

Object.defineProperty(window, 'location', {
  value: { origin: 'http://localhost:3000' },
  writable: true,
});

const mockSignInWithOAuth = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

import { GoogleAuthButton } from '@/components/google-auth-button';

describe('GoogleAuthButton', () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders with default label', () => {
    render(<GoogleAuthButton />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<GoogleAuthButton label="Sign in with Google" />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('calls signInWithOAuth with provider=google and correct redirectTo on click', async () => {
    render(<GoogleAuthButton next="/onboarding" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?next=%2Fonboarding',
      },
    });
  });

  it('URL-encodes the next param', async () => {
    render(<GoogleAuthButton next="/app/settings?tab=account" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo:
          'http://localhost:3000/auth/callback?next=%2Fapp%2Fsettings%3Ftab%3Daccount',
      },
    });
  });

  it('shows the error message when OAuth returns an error', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ error: { message: 'Provider not enabled' } });
    render(<GoogleAuthButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(screen.getByText(/provider not enabled/i)).toBeInTheDocument();
  });

  it('can be disabled via prop', () => {
    render(<GoogleAuthButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
