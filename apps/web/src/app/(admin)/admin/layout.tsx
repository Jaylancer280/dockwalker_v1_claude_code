import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { ToastWrapper } from '@/components/toast-wrapper';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data } = await supabase.from('persons').select('is_admin').eq('id', user.id).single();

  if (!data?.is_admin) redirect('/');

  return (
    <ToastWrapper>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </ToastWrapper>
  );
}
