import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';

// signup uses window.location.href for navigation (not router.push)
const locationAssignSpy = vi.fn();
Object.defineProperty(window, 'location', {
  value: { href: '', assign: locationAssignSpy },
  writable: true,
});

const mockGetUser = vi.fn();
const mockSignUp = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      getUser: mockGetUser,
    },
  }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return <img {...rest} />;
  },
}));

import SignUpPage from '@/app/auth/signup/page';

describe('SignUpPage — session polling after success', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  async function submitForm() {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    });
  }

  it('shows waiting message and does not redirect when getUser returns null', async () => {
    render(<SignUpPage />);
    await submitForm();

    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/this page will update automatically/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(window.location.href).not.toBe('/onboarding');
  });

  it('redirects to /onboarding when getUser returns a valid user', async () => {
    render(<SignUpPage />);
    await submitForm();

    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'test@example.com' } }, error: null });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(window.location.href).toBe('/onboarding');
  });

  it('cleans up interval on unmount', async () => {
    const { unmount } = render(<SignUpPage />);
    await submitForm();

    expect(screen.getByText(/check your email/i)).toBeInTheDocument();

    unmount();

    mockGetUser.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
