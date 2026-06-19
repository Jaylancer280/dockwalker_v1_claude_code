import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';

Object.defineProperty(window, 'location', {
  value: { href: '', origin: 'http://localhost:3000' },
  writable: true,
});

const mockGetUser = vi.fn();
const mockSignUp = vi.fn();
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fill, priority, alt, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={(alt as string) ?? ''} {...rest} />;
  },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import SignUpPage from '@/app/auth/signup/page';

describe('SignUpPage — duplicate email handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  async function submitForm() {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'taken@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    });
  }

  it('shows the already-registered card when Supabase returns empty identities', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [] }, session: null },
      error: null,
    });

    render(<SignUpPage />);
    await submitForm();

    expect(screen.getByText(/account already exists/i)).toBeInTheDocument();
    expect(screen.getByText(/taken@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/auth/login');
    expect(screen.getByRole('link', { name: /reset password/i })).toHaveAttribute(
      'href',
      '/auth/forgot-password',
    );
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it('shows the already-registered card when Supabase returns "already registered" error', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    render(<SignUpPage />);
    await submitForm();

    expect(screen.getByText(/account already exists/i)).toBeInTheDocument();
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it('still shows "Check your email" for a genuinely new signup', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null },
      error: null,
    });

    render(<SignUpPage />);
    await submitForm();

    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.queryByText(/account already exists/i)).not.toBeInTheDocument();
  });

  it('"Use a different email" returns to the form and clears fields', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [] }, session: null },
      error: null,
    });

    render(<SignUpPage />);
    await submitForm();

    expect(screen.getByText(/account already exists/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use a different email/i }));
    });

    expect(screen.queryByText(/account already exists/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('still surfaces non-duplicate Supabase errors as inline error text', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Network error' },
    });

    render(<SignUpPage />);
    await submitForm();

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.queryByText(/account already exists/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });
});
