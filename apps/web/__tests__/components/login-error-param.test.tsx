import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // Strip next/image-specific props so they don't bleed onto the DOM <img>.
    const { fill: _fill, priority: _priority, alt, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img alt={typeof alt === 'string' ? alt : ''} {...rest} />;
  },
}));

import LoginPage from '@/app/auth/login/page';

describe('LoginPage — error display', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders normally with no error param', () => {
    mockGet.mockReturnValue(null);
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/couldn't verify/i)).not.toBeInTheDocument();
  });

  it('shows info message when error=auth_failed', () => {
    mockGet.mockImplementation((key: string) => (key === 'error' ? 'auth_failed' : null));
    render(<LoginPage />);

    expect(screen.getByText(/couldn't verify your email automatically/i)).toBeInTheDocument();
  });

  it('shows login_error from server redirect', () => {
    mockGet.mockImplementation((key: string) =>
      key === 'login_error' ? 'Invalid credentials' : null,
    );
    render(<LoginPage />);

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('form submits natively to /api/auth/login', () => {
    mockGet.mockReturnValue(null);
    render(<LoginPage />);

    const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
    expect(form).toHaveAttribute('method', 'POST');
    expect(form).toHaveAttribute('action', '/api/auth/login');
  });
});
