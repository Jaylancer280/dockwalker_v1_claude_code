import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/daywork/templates/[id]
 * Returns a single template by ID.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const { data: template, error } = await supabase
    .from('daywork_templates')
    .select(
      `
      id, name, role_id, location_port_id,
      working_days, required_certification_ids, experience_bracket_id,
      day_rate, currency, meals, notes
    `,
    )
    .eq('id', id)
    .eq('person_id', user.id)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template });
}

/**
 * DELETE /api/daywork/templates/[id]
 * Deletes a template.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const { error } = await supabase
    .from('daywork_templates')
    .delete()
    .eq('id', id)
    .eq('person_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
