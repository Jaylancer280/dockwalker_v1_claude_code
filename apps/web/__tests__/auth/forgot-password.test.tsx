import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const mockResetPasswordForEmail = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
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

import ForgotPasswordPage from '@/app/auth/forgot-password/page';

describe('Forgot Password page', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with email input and submit button', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole('textbox')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDefined();
  });

  it('calls resetPasswordForEmail with correct email and redirectTo', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: expect.stringContaining('/auth/callback?next=/auth/reset-password'),
      });
    });
  });

  it('shows success message after submission', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByText(/you'll receive an email/i)).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeDefined();
    });
  });
});
