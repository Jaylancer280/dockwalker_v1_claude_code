import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';

export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data, error } = await supabase
      .from('shore_experiences')
      .select(
        `id, category_id, employer_name, job_title, start_date, end_date,
         is_current, description, created_at, updated_at,
         shore_experience_categories(id, name)`,
      )
      .eq('person_id', user.id)
      .order('start_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ experiences: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;

    const body = await request.json().catch(() => ({}));
    const { categoryId, employerName, jobTitle, startDate, endDate, isCurrent, description } = body;

    if (!categoryId || !employerName || !jobTitle || !startDate) {
      return NextResponse.json(
        { error: 'categoryId, employerName, jobTitle, and startDate are required' },
        { status: 400 },
      );
    }

    if (typeof employerName !== 'string' || employerName.length > 100) {
      return NextResponse.json(
        { error: 'Employer name must be 100 characters or less' },
        { status: 400 },
      );
    }

    if (typeof jobTitle !== 'string' || jobTitle.length > 100) {
      return NextResponse.json(
        { error: 'Job title must be 100 characters or less' },
        { status: 400 },
      );
    }

    if (description && description.length > 250) {
      return NextResponse.json(
        { error: 'Description must be 250 characters or less' },
        { status: 400 },
      );
    }

    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
    }

    const { data: category } = await serviceClient
      .from('shore_experience_categories')
      .select('id')
      .eq('id', categoryId)
      .maybeSingle();

    if (!category) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const id = randomUUID();

    await appendEvent(serviceClient, {
      eventType: 'SHORE_EXPERIENCE.ADDED',
      aggregateId: id,
      aggregateType: 'shore_experience',
      roleContext: person.current_hat,
      payload: {
        id,
        category_id: categoryId,
        employer_name: employerName.trim(),
        job_title: jobTitle.trim(),
        start_date: startDate,
        end_date: endDate ?? null,
        is_current: isCurrent ?? false,
        description: description?.trim() ?? null,
      },
      personId: user.id,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
