import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

type SubscribeCallback = (status: string) => void;
type ChangeCallback = (payload: { new: unknown }) => void;

let changeCallback: ChangeCallback | null = null;

const mockRemoveChannel = vi.fn();
const mockSubscribe = vi.fn().mockImplementation((_cb: SubscribeCallback) => {
  return { unsubscribe: vi.fn() };
});
const mockOn = vi.fn().mockImplementation(
  (_event: string, _filter: unknown, cb: ChangeCallback) => {
    changeCallback = cb;
    return { subscribe: mockSubscribe };
  },
);
const mockChannel = vi.fn().mockReturnValue({ on: mockOn });

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  }),
}));

import { useRealtimeMessages } from '@/hooks/use-realtime-messages';

describe('useRealtimeMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changeCallback = null;
  });

  it('subscribes to correct channel with engagement_id filter', () => {
    const onNewMessage = vi.fn();
    renderHook(() => useRealtimeMessages('eng-123', onNewMessage));

    expect(mockChannel).toHaveBeenCalledWith('messages:eng-123');
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'engagement_id=eq.eng-123',
      }),
      expect.any(Function),
    );
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('calls onNewMessage when INSERT payload received', () => {
    const onNewMessage = vi.fn();
    renderHook(() => useRealtimeMessages('eng-123', onNewMessage));

    const newMsg = {
      id: 'msg-1',
      engagement_id: 'eng-123',
      sender_person_id: 'u1',
      content: 'Hello',
      is_system: false,
      created_at: '2026-04-01T12:00:00Z',
    };

    act(() => {
      changeCallback?.({ new: newMsg });
    });

    expect(onNewMessage).toHaveBeenCalledWith(newMsg);
  });

  it('unsubscribes on unmount', () => {
    const onNewMessage = vi.fn();
    const { unmount } = renderHook(() => useRealtimeMessages('eng-123', onNewMessage));

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
