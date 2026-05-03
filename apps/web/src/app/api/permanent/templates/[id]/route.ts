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

    // B-005: select must mirror POST's insertable field set so edit-mode
    // pre-fill rehydrates every field. Original list dropped
    // required_languages, contract_type, contract_details, description,
    // meals, and positions_available, so editing those fields silently
    // discarded user input on save (PATCH was also missing them).
    const { data: template, error } = await supabase
      .from('permanent_templates')
      .select(
        `
        id, template_name, vessel_id, role_id, port_id,
        start_date, salary_min, salary_max, salary_currency, salary_period,
        live_aboard, required_certification_ids, required_languages,
        experience_bracket_id, shortlist_cap, notes,
        contract_type, contract_details, description, meals,
        positions_available
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

    // Build update object with only provided fields. B-005: this set must
    // match the POST handler in /api/permanent/templates/route.ts so all
    // form fields round-trip on edit. Missing handlers here used to drop
    // required_languages / contract_type / contract_details / description
    // / meals / positions_available silently — PATCH returned 200 success
    // with no actual change to those columns.
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
    if (body.requiredLanguages !== undefined) updates.required_languages = body.requiredLanguages;
    if (body.experienceBracketId !== undefined)
      updates.experience_bracket_id = body.experienceBracketId;
    if (body.shortlistCap !== undefined) updates.shortlist_cap = body.shortlistCap;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.contractType !== undefined) updates.contract_type = body.contractType;
    if (body.contractDetails !== undefined) updates.contract_details = body.contractDetails;
    if (body.description !== undefined) updates.description = body.description;
    if (body.meals !== undefined) updates.meals = body.meals;
    if (body.positionsAvailable !== undefined)
      updates.positions_available = body.positionsAvailable;

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
