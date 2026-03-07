import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/hat
 * Switch the user's current hat.
 * Body: { hat: 'crew' | 'employer' }
 *
 * Rules:
 * - Crew identity_type can switch between 'crew' and 'employer'
 * - Agent identity_type can only wear 'agent' (cannot switch)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: person } = await supabase
    .from('persons')
    .select('id, identity_type, current_hat')
    .eq('id', user.id)
    .single();

  if (!person) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const { hat } = body;

  if (!hat || !['crew', 'employer'].includes(hat)) {
    return NextResponse.json({ error: 'Invalid hat' }, { status: 400 });
  }

  // Agents cannot switch hats
  if (person.identity_type === 'agent') {
    return NextResponse.json({ error: 'Agents cannot switch hats' }, { status: 403 });
  }

  // Already wearing this hat
  if (person.current_hat === hat) {
    return NextResponse.json({ success: true, hat });
  }

  const { error } = await serviceClient.rpc('append_event', {
    p_event_type: 'PERSON.HAT_CHANGED',
    p_aggregate_id: user.id,
    p_aggregate_type: 'person',
    p_role_context: hat,
    p_payload: {
      current_hat: hat,
    },
    p_person_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, hat });
}
