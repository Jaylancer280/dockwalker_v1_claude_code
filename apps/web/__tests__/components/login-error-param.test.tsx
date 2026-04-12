import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return <img {...rest} />;
  },
}));

import LoginPage from '@/app/auth/login/page';

describe('LoginPage — error query param', () => {
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
    mockGet.mockReturnValue('auth_failed');
    render(<LoginPage />);

    expect(screen.getByText(/couldn't verify your email automatically/i)).toBeInTheDocument();
  });

  it('does not show message for other error values', () => {
    mockGet.mockReturnValue('some_other_error');
    render(<LoginPage />);

    expect(screen.queryByText(/couldn't verify/i)).not.toBeInTheDocument();
  });
});
