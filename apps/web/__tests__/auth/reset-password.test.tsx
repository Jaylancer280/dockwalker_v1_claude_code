import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      updateUser: mockUpdateUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  }),
}));

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import ResetPasswordPage from '@/app/auth/reset-password/page';

describe('Reset Password page', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    // Default fetch mock — reactivate returns no-op (account was active)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ reactivated: false })),
    }) as unknown as typeof fetch;
  });

  it('renders password and confirm password fields', async () => {
    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByTestId('new-password')).toBeDefined();
    });
    expect(screen.getByTestId('confirm-password')).toBeDefined();
  });

  it('validates passwords match', async () => {
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByTestId('new-password'));

    fireEvent.change(screen.getByTestId('new-password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByTestId('confirm-password'), {
      target: { value: 'different456' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeDefined();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('validates minimum length', async () => {
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByTestId('new-password'));

    fireEvent.change(screen.getByTestId('new-password'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByTestId('confirm-password'), {
      target: { value: 'short' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeDefined();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser with new password on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByTestId('new-password'));

    fireEvent.change(screen.getByTestId('new-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByTestId('confirm-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/reactivate', { method: 'POST' });
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(screen.getByText(/sign in with your new password/i)).toBeDefined();
    });
  });

  it('shows "Welcome back" when reactivate returns reactivated: true', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ reactivated: true })),
    }) as unknown as typeof fetch;

    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByTestId('new-password'));

    fireEvent.change(screen.getByTestId('new-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByTestId('confirm-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeDefined();
      expect(screen.getByText(/account has been restored/i)).toBeDefined();
    });
  });

  it('still shows success when reactivate fetch fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByTestId('new-password'));

    fireEvent.change(screen.getByTestId('new-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByTestId('confirm-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(screen.getByText(/sign in with your new password/i)).toBeDefined();
    });
  });

  it('shows expired link message when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText('Link expired')).toBeDefined();
      expect(screen.getByText('Request a new reset link')).toBeDefined();
    });
  });
});
