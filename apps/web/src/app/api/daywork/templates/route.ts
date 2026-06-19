import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { requireSubscription } from '@/lib/require-subscription';

/**
 * GET /api/daywork/templates
 * Lists the authenticated user's daywork templates.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data: templates, error } = await supabase
      .from('daywork_templates')
      .select(
        `
        id, name, role_id, location_port_id,
        working_days, required_certification_ids, required_languages, experience_bracket_id,
        day_rate, currency, meals, notes, positions_available, permanent_opportunity, created_at,
        yacht_roles(name),
        ports(name, cities(name, regions(name)))
      `,
      )
      .eq('person_id', user.id)
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
 * POST /api/daywork/templates
 * Creates a new daywork template.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    // Template cap enforcement
    const subResult = await requireSubscription(supabase, user.id, 'employer_pro');
    if (!subResult.ok) {
      // Free tier — enforce cap
      const cap = person.current_hat === 'crew' ? 5 : 3;
      const { count } = await supabase
        .from('daywork_templates')
        .select('id', { count: 'exact', head: true })
        .eq('person_id', user.id);
      if ((count ?? 0) >= cap) {
        return NextResponse.json(
          { error: 'template_limit_reached', limit: cap, upgrade_url: '/billing' },
          { status: 402 },
        );
      }
    }

    const body = await request.json().catch(() => ({}));

    const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'];
    if (body.currency && !VALID_CURRENCIES.includes(body.currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    // Build the insert payload with ONLY fields the user supplied (B-005).
    // Schema is already nullable on every column except `name`; coercing
    // missing fields to '' / null / 0 polluted the data and made the saved
    // template look like it had been configured when the user had only
    // typed a name.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insert: Record<string, any> = {
      person_id: user.id,
      name: body.name.slice(0, 100),
    };
    if (body.roleId) insert.role_id = body.roleId;
    if (body.locationPortId) insert.location_port_id = body.locationPortId;
    if (typeof body.workingDays === 'number') insert.working_days = body.workingDays;
    if (Array.isArray(body.requiredCertificationIds))
      insert.required_certification_ids = body.requiredCertificationIds;
    if (Array.isArray(body.requiredLanguages)) insert.required_languages = body.requiredLanguages;
    if (body.experienceBracketId) insert.experience_bracket_id = body.experienceBracketId;
    if (typeof body.dayRate === 'number') insert.day_rate = body.dayRate;
    if (body.currency) insert.currency = body.currency;
    if (Array.isArray(body.meals)) insert.meals = body.meals;
    if (typeof body.notes === 'string') insert.notes = body.notes;
    if (typeof body.positionsAvailable === 'number')
      insert.positions_available = body.positionsAvailable;
    if (typeof body.permanentOpportunity === 'boolean')
      insert.permanent_opportunity = body.permanentOpportunity;

    const { data, error } = await supabase
      .from('daywork_templates')
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
