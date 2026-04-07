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

    const { data, error } = await supabase
      .from('daywork_templates')
      .insert({
        person_id: user.id,
        name: typeof body.name === 'string' ? body.name.slice(0, 100) : body.name,
        role_id: body.roleId || null,
        location_port_id: body.locationPortId || null,
        working_days: body.workingDays || null,
        required_certification_ids: body.requiredCertificationIds || [],
        required_languages: body.requiredLanguages || [],
        experience_bracket_id: body.experienceBracketId || null,
        day_rate: body.dayRate || null,
        currency: body.currency || 'EUR',
        meals: body.meals || [],
        notes: body.notes || null,
        positions_available: body.positionsAvailable || 1,
        permanent_opportunity: body.permanentOpportunity === true,
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
