import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BottomNav } from '@/components/bottom-nav';
import { ToastWrapper } from '@/components/toast-wrapper';

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
      <div className="pb-nav">{children}</div>
      <BottomNav currentHat={person.current_hat} identityType={person.identity_type} />
    </ToastWrapper>
  );
}
