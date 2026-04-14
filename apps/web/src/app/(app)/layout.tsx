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

  // Fast path: read from JWT claims (injected by custom_access_token_hook, migration 00078).
  // Fallback: query persons table for brand-new users whose JWT hasn't refreshed yet.
  const appMeta = user.app_metadata as
    | { person_id?: string; current_hat?: string; identity_type?: string }
    | undefined;

  let personId: string;
  let currentHat: string;
  let identityType: string;
  let isAdmin = false;

  if (appMeta?.person_id && appMeta?.current_hat && appMeta?.identity_type) {
    personId = appMeta.person_id;
    currentHat = appMeta.current_hat;
    identityType = appMeta.identity_type;
    const { data: adminCheck } = await supabase
      .from('persons')
      .select('is_admin')
      .eq('id', personId)
      .single();
    isAdmin = adminCheck?.is_admin === true;
  } else {
    const { data: person } = await supabase
      .from('persons')
      .select('id, identity_type, current_hat, is_admin')
      .eq('id', user.id)
      .single();

    if (!person) redirect('/onboarding');

    personId = person.id;
    currentHat = person.current_hat;
    identityType = person.identity_type;
    isAdmin = person.is_admin === true;
  }

  return (
    <ToastWrapper>
      <VoiceCallProvider>
        <LookupsProvider>
          <NotificationCountsProvider>
            <OfflineBanner />
            <DeferredMount>
              <IncomingCallListener personId={personId} />
            </DeferredMount>
            <SidebarNav currentHat={currentHat} identityType={identityType} isAdmin={isAdmin} />
            <div className="pb-nav md:ml-[var(--sidebar-width)] md:pb-0">{children}</div>
            <BottomNav currentHat={currentHat} identityType={identityType} isAdmin={isAdmin} />
          </NotificationCountsProvider>
        </LookupsProvider>
      </VoiceCallProvider>
    </ToastWrapper>
  );
}
