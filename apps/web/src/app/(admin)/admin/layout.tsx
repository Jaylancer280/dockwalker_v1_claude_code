import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { ToastWrapper } from '@/components/toast-wrapper';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Audit P1-F4: distinguish "not admin" (notFound — clean Forbidden UX
  // via the dedicated 404 page) from "RLS / network / DB error" (throw
  // so the (admin)/admin/error.tsx boundary catches and shows a real
  // error). Previously both paths silently redirected to '/', which
  // bounced non-admins without explanation and masked transient
  // failures as "you're not admin".
  const { data, error } = await supabase
    .from('persons')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (error) {
    throw new Error(`Could not verify admin status: ${error.message}`);
  }

  if (!data?.is_admin) {
    notFound();
  }

  return (
    <ToastWrapper>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </ToastWrapper>
  );
}
