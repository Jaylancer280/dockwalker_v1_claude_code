'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeMessage {
  id: string;
  engagement_id: string;
  sender_person_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

export function useRealtimeMessages(
  engagementId: string,
  onNewMessage: (message: RealtimeMessage) => void,
) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onNewMessage);
  useEffect(() => {
    callbackRef.current = onNewMessage;
  });

  useEffect(() => {
    const supabase = createClient();

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
          callbackRef.current(payload.new as RealtimeMessage);
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [engagementId]);

  return { isConnected };
}
