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
 * Canonical tables sort + search on different columns depending on shape:
 * experience_brackets and vessel_size_bands use `label`; everything else uses
 * `name`.
 */
function sortColumnFor(table: AllowedTable): 'name' | 'label' {
  return table === 'experience_brackets' || table === 'vessel_size_bands' ? 'label' : 'name';
}

const MAX_PAGE_SIZE = 500;

/**
 * GET /api/admin/canonical/:table
 *
 * Returns rows from the specified canonical table.
 *
 * Query params (optional):
 * - `page`     — 1-indexed page number. When absent, pagination is disabled
 *                and the route returns every row in the table (legacy
 *                behaviour for small lookup tables like yacht_roles).
 * - `pageSize` — rows per page (default 50, capped at 500). Ignored unless
 *                `page` is also present.
 * - `q`        — case-insensitive substring match on the sort column
 *                (`name` or `label`). Works with or without pagination.
 *
 * Ports (~6k rows) and cities (~3.4k rows) should always use pagination.
 */
export async function GET(request: Request, { params }: { params: Promise<{ table: string }> }) {
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
    const url = new URL(request.url);
    const rawPage = url.searchParams.get('page');
    const rawPageSize = url.searchParams.get('pageSize');
    const q = url.searchParams.get('q')?.trim() ?? '';
    const paginated = rawPage !== null;
    const page = paginated ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;
    const pageSize = paginated
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(rawPageSize ?? '50', 10) || 50))
      : 0;

    const sortCol = sortColumnFor(table);

    if (paginated) {
      let query = serviceClient.from(table).select('*', { count: 'exact' }).order(sortCol);
      if (q) query = query.ilike(sortCol, `%${q}%`);
      const offset = (page - 1) * pageSize;
      const { data, count, error } = await query.range(offset, offset + pageSize - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const total = count ?? 0;
      return NextResponse.json({
        rows: data ?? [],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    // Legacy unpaginated path
    let query = serviceClient.from(table).select('*').order(sortCol);
    if (q) query = query.ilike(sortCol, `%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
