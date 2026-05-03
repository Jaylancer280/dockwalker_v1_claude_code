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

  try {
    const { user, supabase } = guard.value;

    // B-005: SELECT must mirror POST/PATCH writable fields so edit-mode
    // pre-fill rehydrates everything. `required_languages` was missing,
    // so re-opening a template with languages set showed the languages
    // chip cleared — and re-saving without re-picking languages
    // discarded them.
    const { data: template, error } = await supabase
      .from('daywork_templates')
      .select(
        `
        id, name, role_id, location_port_id,
        working_days, required_certification_ids, required_languages,
        experience_bracket_id, day_rate, currency, meals, notes,
        positions_available, permanent_opportunity
      `,
      )
      .eq('id', id)
      .eq('person_id', user.id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/daywork/templates/[id]
 * Updates a daywork template. B-005: parity with permanent templates.
 * Owner-scoped via the auth.uid() check + the explicit person_id filter.
 * Requires migration 00134 which added the missing UPDATE RLS policy on
 * daywork_templates (the table previously had only SELECT/INSERT/DELETE).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const body = await request.json().catch(() => ({}));

    if (body.currency) {
      const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'];
      if (!VALID_CURRENCIES.includes(body.currency)) {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      }
    }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'Template name cannot be empty' }, { status: 400 });
      }
    }

    // Build update object with only provided fields. Mirrors permanent
    // templates PATCH: `undefined` = leave alone, explicit `null` = clear.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = (body.name as string).slice(0, 100);
    if (body.roleId !== undefined) updates.role_id = body.roleId;
    if (body.locationPortId !== undefined) updates.location_port_id = body.locationPortId;
    if (body.workingDays !== undefined) updates.working_days = body.workingDays;
    if (body.requiredCertificationIds !== undefined)
      updates.required_certification_ids = body.requiredCertificationIds;
    if (body.requiredLanguages !== undefined) updates.required_languages = body.requiredLanguages;
    if (body.experienceBracketId !== undefined)
      updates.experience_bracket_id = body.experienceBracketId;
    if (body.dayRate !== undefined) updates.day_rate = body.dayRate;
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.meals !== undefined) updates.meals = body.meals;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.positionsAvailable !== undefined)
      updates.positions_available = body.positionsAvailable;
    if (body.permanentOpportunity !== undefined)
      updates.permanent_opportunity = body.permanentOpportunity;

    const { error } = await supabase
      .from('daywork_templates')
      .update(updates)
      .eq('id', id)
      .eq('person_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/daywork/templates/[id]
 * Deletes a template.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
