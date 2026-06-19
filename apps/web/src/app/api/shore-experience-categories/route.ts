import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { supabase } = guard.value;

    const { data, error } = await supabase
      .from('shore_experience_categories')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
