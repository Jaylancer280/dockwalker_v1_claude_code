import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { requireSubscription } from '@/lib/require-subscription';

/**
 * GET /api/permanent/templates
 * Lists the authenticated user's permanent templates.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data: templates, error } = await supabase
      .from('permanent_templates')
      .select(
        `
        id, template_name, vessel_id, role_id, port_id,
        start_date, salary_min, salary_max, salary_currency, salary_period,
        live_aboard, required_certification_ids, required_languages, experience_bracket_id,
        shortlist_cap, notes, contract_type, contract_details, description, meals,
        positions_available, created_at,
        yacht_roles(name),
        ports(name, cities(name, regions(name)))
      `,
      )
      .eq('employer_person_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/permanent/templates
 * Creates a new permanent template.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    if (!['employer', 'agent'].includes(person.current_hat)) {
      return NextResponse.json(
        { error: 'Only employers and agents can create templates' },
        { status: 403 },
      );
    }

    // Template cap enforcement
    const subResult = await requireSubscription(supabase, user.id, 'employer_pro');
    if (!subResult.ok) {
      // Free tier — cap = 1 permanent template
      const { count } = await supabase
        .from('permanent_templates')
        .select('id', { count: 'exact', head: true })
        .eq('employer_person_id', user.id);
      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: 'template_limit_reached', limit: 1, upgrade_url: '/billing' },
          { status: 402 },
        );
      }
    }

    const body = await request.json().catch(() => ({}));

    const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'];
    if (body.salaryCurrency && !VALID_CURRENCIES.includes(body.salaryCurrency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    const VALID_PERIODS = ['monthly', 'annual'];
    if (body.salaryPeriod && !VALID_PERIODS.includes(body.salaryPeriod)) {
      return NextResponse.json({ error: 'Invalid salary period' }, { status: 400 });
    }

    if (!body.templateName || typeof body.templateName !== 'string' || !body.templateName.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    // Build the insert payload with ONLY fields the user supplied. Templates
    // are intentionally partial (B-005): "Deckhand €2500" with just role +
    // salary is a valid template. The previous code coerced missing fields
    // to 0 / '' / 'EUR' / today's date which both polluted the data and
    // collided with NOT NULL constraints (relaxed in migration 00134).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insert: Record<string, any> = {
      employer_person_id: user.id,
      template_name: body.templateName.slice(0, 100),
    };
    if (body.vesselId) insert.vessel_id = body.vesselId;
    if (body.roleId) insert.role_id = body.roleId;
    if (body.locationPortId) insert.port_id = body.locationPortId;
    if (body.startDate) insert.start_date = body.startDate;
    if (typeof body.salaryMin === 'number') insert.salary_min = body.salaryMin;
    if (typeof body.salaryMax === 'number') insert.salary_max = body.salaryMax;
    if (body.salaryCurrency) insert.salary_currency = body.salaryCurrency;
    if (body.salaryPeriod) insert.salary_period = body.salaryPeriod;
    if (typeof body.liveAboard === 'boolean') insert.live_aboard = body.liveAboard;
    if (Array.isArray(body.requiredCertificationIds))
      insert.required_certification_ids = body.requiredCertificationIds;
    if (Array.isArray(body.requiredLanguages)) insert.required_languages = body.requiredLanguages;
    if (body.experienceBracketId) insert.experience_bracket_id = body.experienceBracketId;
    if (typeof body.shortlistCap === 'number') insert.shortlist_cap = body.shortlistCap;
    if (typeof body.notes === 'string') insert.notes = body.notes;
    if (body.contractType) insert.contract_type = body.contractType;
    if (body.contractDetails) insert.contract_details = body.contractDetails;
    if (typeof body.description === 'string') insert.description = body.description;
    if (Array.isArray(body.meals)) insert.meals = body.meals;
    if (typeof body.positionsAvailable === 'number')
      insert.positions_available = body.positionsAvailable;

    const { data, error } = await supabase
      .from('permanent_templates')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
