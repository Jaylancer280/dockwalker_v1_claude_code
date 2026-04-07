import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BottomNav } from '@/components/bottom-nav';
import { SidebarNav } from '@/components/sidebar-nav';
import { ToastWrapper } from '@/components/toast-wrapper';
import { OfflineBanner } from '@/components/offline-banner';
import { LookupsProvider } from '@/hooks/use-lookups';
import { NotificationCountsProvider } from '@/hooks/use-notification-counts';
import { VoiceCallProvider } from '@/contexts/voice-call-context';
import { IncomingCallListener } from '@/components/incoming-call-listener';
import { DeferredMount } from '@/components/deferred-mount';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: person } = await supabase
    .from('persons')
    .select('id, identity_type, current_hat')
    .eq('id', user.id)
    .single();

  if (!person) redirect('/onboarding');

  return (
    <ToastWrapper>
      <VoiceCallProvider>
        <LookupsProvider>
          <NotificationCountsProvider>
            <OfflineBanner />
            <DeferredMount>
              <IncomingCallListener personId={person.id} />
            </DeferredMount>
            <SidebarNav currentHat={person.current_hat} identityType={person.identity_type} />
            <div className="pb-nav md:ml-[var(--sidebar-width)] md:pb-0">{children}</div>
            <BottomNav currentHat={person.current_hat} identityType={person.identity_type} />
          </NotificationCountsProvider>
        </LookupsProvider>
      </VoiceCallProvider>
    </ToastWrapper>
  );
}
