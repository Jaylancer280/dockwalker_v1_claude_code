import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

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
        shortlist_cap, notes, created_at,
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

    const body = await request.json().catch(() => ({}));

    const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'];
    if (body.salaryCurrency && !VALID_CURRENCIES.includes(body.salaryCurrency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    const VALID_PERIODS = ['monthly', 'annual'];
    if (body.salaryPeriod && !VALID_PERIODS.includes(body.salaryPeriod)) {
      return NextResponse.json({ error: 'Invalid salary period' }, { status: 400 });
    }

    if (!body.templateName) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('permanent_templates')
      .insert({
        employer_person_id: user.id,
        template_name:
          typeof body.templateName === 'string'
            ? body.templateName.slice(0, 100)
            : body.templateName,
        vessel_id: body.vesselId || null,
        role_id: body.roleId || null,
        port_id: body.locationPortId || null,
        start_date: body.startDate || new Date().toISOString().slice(0, 10),
        salary_min: body.salaryMin || 0,
        salary_max: body.salaryMax || 0,
        salary_currency: body.salaryCurrency || 'EUR',
        salary_period: body.salaryPeriod || 'monthly',
        live_aboard: body.liveAboard === true,
        required_certification_ids: body.requiredCertificationIds || [],
        required_languages: body.requiredLanguages || [],
        experience_bracket_id: body.experienceBracketId || null,
        shortlist_cap: body.shortlistCap || 5,
        notes: body.notes || null,
      })
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
