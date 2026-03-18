import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';

const ALLOWED_TABLES = [
  'regions',
  'cities',
  'ports',
  'yacht_roles',
  'certifications',
  'experience_brackets',
  'vessel_size_bands',
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

function isAllowedTable(table: string): table is AllowedTable {
  return ALLOWED_TABLES.includes(table as AllowedTable);
}

/**
 * GET /api/admin/canonical/:table
 * Returns all rows from the specified canonical table.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ table: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { table } = await params;

  if (!isAllowedTable(table)) {
    return NextResponse.json(
      { error: `Invalid table. Allowed: ${ALLOWED_TABLES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await serviceClient.from(table).select('*').order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch canonical data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/canonical/:table
 * Insert a new canonical record.
 */
export async function POST(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;
  const { table } = await params;

  if (!isAllowedTable(table)) {
    return NextResponse.json(
      { error: `Invalid table. Allowed: ${ALLOWED_TABLES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    const { data, error } = await serviceClient.from(table).insert(body).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit event
    appendEvent(serviceClient, {
      eventType: 'ADMIN.CANONICAL_ADDED',
      aggregateId: randomUUID(),
      aggregateType: 'admin',
      roleContext: 'employer',
      payload: { table, record_id: data.id, admin_person_id: user.id },
      personId: user.id,
    }).catch(() => {});

    return NextResponse.json({ record: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create record';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/canonical/:table
 * Update a canonical record. Body must include { id, ...fields }.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ table: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;
  const { table } = await params;

  if (!isAllowedTable(table)) {
    return NextResponse.json(
      { error: `Invalid table. Allowed: ${ALLOWED_TABLES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from(table)
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit event
    appendEvent(serviceClient, {
      eventType: 'ADMIN.CANONICAL_UPDATED',
      aggregateId: randomUUID(),
      aggregateType: 'admin',
      roleContext: 'employer',
      payload: { table, record_id: id, fields, admin_person_id: user.id },
      personId: user.id,
    }).catch(() => {});

    return NextResponse.json({ record: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update record';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
