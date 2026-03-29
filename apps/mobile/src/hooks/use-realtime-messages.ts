import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from './use-messages';

export function useRealtimeMessages(
  engagementId: string,
  onNewMessage: (msg: Message) => void,
) {
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useEffect(() => {
    if (!engagementId) return;

    const channel = supabase
      .channel(`messages:${engagementId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `engagement_id=eq.${engagementId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          callbackRef.current(row);
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [engagementId]);

  return { isConnected };
}
