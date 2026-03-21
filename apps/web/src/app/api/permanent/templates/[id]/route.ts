import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/permanent/templates/[id]
 * Returns a single permanent template by ID.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data: template, error } = await supabase
      .from('permanent_templates')
      .select(
        `
        id, template_name, vessel_id, role_id, port_id,
        start_date, salary_min, salary_max, salary_currency, salary_period,
        live_aboard, required_certification_ids, experience_bracket_id,
        shortlist_cap, notes
      `,
      )
      .eq('id', id)
      .eq('employer_person_id', user.id)
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
 * PATCH /api/permanent/templates/[id]
 * Updates a permanent template.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const body = await request.json().catch(() => ({}));

    if (body.salaryCurrency) {
      const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'];
      if (!VALID_CURRENCIES.includes(body.salaryCurrency)) {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      }
    }

    if (body.salaryPeriod) {
      const VALID_PERIODS = ['monthly', 'annual'];
      if (!VALID_PERIODS.includes(body.salaryPeriod)) {
        return NextResponse.json({ error: 'Invalid salary period' }, { status: 400 });
      }
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.templateName !== undefined)
      updates.template_name =
        typeof body.templateName === 'string' ? body.templateName.slice(0, 100) : body.templateName;
    if (body.vesselId !== undefined) updates.vessel_id = body.vesselId;
    if (body.roleId !== undefined) updates.role_id = body.roleId;
    if (body.locationPortId !== undefined) updates.port_id = body.locationPortId;
    if (body.startDate !== undefined) updates.start_date = body.startDate;
    if (body.salaryMin !== undefined) updates.salary_min = body.salaryMin;
    if (body.salaryMax !== undefined) updates.salary_max = body.salaryMax;
    if (body.salaryCurrency !== undefined) updates.salary_currency = body.salaryCurrency;
    if (body.salaryPeriod !== undefined) updates.salary_period = body.salaryPeriod;
    if (body.liveAboard !== undefined) updates.live_aboard = body.liveAboard;
    if (body.requiredCertificationIds !== undefined)
      updates.required_certification_ids = body.requiredCertificationIds;
    if (body.experienceBracketId !== undefined)
      updates.experience_bracket_id = body.experienceBracketId;
    if (body.shortlistCap !== undefined) updates.shortlist_cap = body.shortlistCap;
    if (body.notes !== undefined) updates.notes = body.notes;

    const { error } = await supabase
      .from('permanent_templates')
      .update(updates)
      .eq('id', id)
      .eq('employer_person_id', user.id);

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
 * DELETE /api/permanent/templates/[id]
 * Deletes a permanent template.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { error } = await supabase
      .from('permanent_templates')
      .delete()
      .eq('id', id)
      .eq('employer_person_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
