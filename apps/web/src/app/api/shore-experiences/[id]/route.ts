import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;
    const { id } = await params;

    const { data: existing } = await supabase
      .from('shore_experiences')
      .select('id')
      .eq('id', id)
      .eq('person_id', user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Shore experience not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { categoryId, employerName, jobTitle, startDate, endDate, isCurrent, description } = body;

    if (
      employerName !== undefined &&
      (typeof employerName !== 'string' || employerName.length > 100)
    ) {
      return NextResponse.json(
        { error: 'Employer name must be 100 characters or less' },
        { status: 400 },
      );
    }

    if (jobTitle !== undefined && (typeof jobTitle !== 'string' || jobTitle.length > 100)) {
      return NextResponse.json(
        { error: 'Job title must be 100 characters or less' },
        { status: 400 },
      );
    }

    if (description !== undefined && description !== null && description.length > 250) {
      return NextResponse.json(
        { error: 'Description must be 250 characters or less' },
        { status: 400 },
      );
    }

    if (categoryId !== undefined) {
      const { data: category } = await serviceClient
        .from('shore_experience_categories')
        .select('id')
        .eq('id', categoryId)
        .maybeSingle();

      if (!category) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
    }

    const payload: Record<string, unknown> = {};
    if (categoryId !== undefined) payload.category_id = categoryId;
    if (employerName !== undefined) payload.employer_name = employerName.trim();
    if (jobTitle !== undefined) payload.job_title = jobTitle.trim();
    if (startDate !== undefined) payload.start_date = startDate;
    if (endDate !== undefined) payload.end_date = endDate;
    if (isCurrent !== undefined) payload.is_current = isCurrent;
    if (description !== undefined) payload.description = description?.trim() ?? null;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await appendEvent(serviceClient, {
      eventType: 'SHORE_EXPERIENCE.UPDATED',
      aggregateId: id,
      aggregateType: 'shore_experience',
      roleContext: person.current_hat,
      payload: payload as Parameters<typeof appendEvent<'SHORE_EXPERIENCE.UPDATED'>>[1]['payload'],
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;
    const { id } = await params;

    const { data: existing } = await supabase
      .from('shore_experiences')
      .select('id')
      .eq('id', id)
      .eq('person_id', user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Shore experience not found' }, { status: 404 });
    }

    await appendEvent(serviceClient, {
      eventType: 'SHORE_EXPERIENCE.REMOVED',
      aggregateId: id,
      aggregateType: 'shore_experience',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
