import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { PushToast } from '@/components/push-toast';

describe('PushToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing initially', () => {
    const { container } = render(<PushToast />);
    expect(container.querySelector('[data-testid="push-toast"]')).toBeNull();
  });

  it('shows toast when dw:push-foreground event fires', () => {
    render(<PushToast />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('dw:push-foreground', {
          detail: { title: 'New Applicant', body: 'New applicant for DW-00001' },
        }),
      );
    });

    expect(screen.getByTestId('push-toast')).toBeInTheDocument();
    expect(screen.getByText('New Applicant')).toBeInTheDocument();
    expect(screen.getByText('New applicant for DW-00001')).toBeInTheDocument();
  });

  it('auto-dismisses after 5 seconds', () => {
    render(<PushToast />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('dw:push-foreground', {
          detail: { title: 'Test', body: 'Body' },
        }),
      );
    });

    expect(screen.getByTestId('push-toast')).toBeInTheDocument();

    // Advance past 5s dismiss + 300ms animation
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    expect(screen.queryByTestId('push-toast')).toBeNull();
  });

  it('navigates on click when url is present', () => {
    render(<PushToast />);

    // Spy on window.location.href setter
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      get: () => '',
      configurable: true,
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('dw:push-foreground', {
          detail: { title: 'Chat', body: 'New message', url: '/messages/eng-1' },
        }),
      );
    });

    act(() => {
      screen.getByTestId('push-toast').click();
    });

    expect(hrefSetter).toHaveBeenCalledWith('/messages/eng-1');
  });
});
