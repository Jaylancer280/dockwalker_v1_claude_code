import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * GET /api/availability
 * Returns the authenticated crew member's availability windows
 * and their accepted engagements (blocked days).
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    // Get availability windows (only non-expired), include city_id, port_id and not_available
    const { data: windows, error: windowsError } = await supabase
      .from('availability_windows')
      .select('id, date, expires_at, city_id, port_id, not_available')
      .eq('person_id', user.id)
      .gt('expires_at', new Date().toISOString().split('T')[0])
      .order('date');

    if (windowsError) {
      return NextResponse.json({ error: windowsError.message }, { status: 500 });
    }

    // Determine availability status: 'available' | 'not_available' | null
    const notAvailableRow = (windows ?? []).find((w) => w.not_available);
    const availableWindows = (windows ?? []).filter((w) => !w.not_available);
    let status: 'available' | 'not_available' | null = null;
    if (notAvailableRow) {
      status = 'not_available';
    } else if (availableWindows.length > 0) {
      status = 'available';
    }

    // Resolve city name for the windows (use the first non-null city_id from any window)
    let city: { id: string; name: string; region_name: string } | null = null;
    const firstCityId = (windows ?? []).find((w) => w.city_id)?.city_id;
    if (firstCityId) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('id, name, regions(name)')
        .eq('id', firstCityId)
        .single();
      if (cityData) {
        const regions = cityData.regions as unknown as { name: string } | null;
        city = {
          id: cityData.id,
          name: cityData.name,
          region_name: regions?.name ?? '',
        };
      }
    }

    // Get accepted engagements (blocked days)
    const { data: engagements, error: engError } = await supabase
      .from('active_engagements')
      .select(
        'id, start_date, end_date, daywork_id, permanent_posting_id, dayworks(yacht_roles(name)), permanent_postings(yacht_roles(name))',
      )
      .eq('crew_person_id', user.id)
      .eq('status', 'active');

    if (engError) {
      return NextResponse.json({ error: engError.message }, { status: 500 });
    }

    // Resolve port name if any window has port_id
    let port: { id: string; name: string } | null = null;
    const firstPortId = (windows ?? []).find((w) => w.port_id)?.port_id;
    if (firstPortId) {
      const { data: portData } = await supabase
        .from('ports')
        .select('id, name')
        .eq('id', firstPortId)
        .single();
      if (portData) {
        port = { id: portData.id, name: portData.name };
      }
    }

    return NextResponse.json({
      windows: availableWindows,
      engagements: engagements ?? [],
      city,
      port,
      status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/availability
 * Set availability for a date range. Crew hat only.
 *
 * Body: {
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   cityId: string (uuid, required)
 * }
 *
 * Enforces:
 * - 14-day rolling window (today through today+13)
 * - 7-day hard expiry
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can set availability' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { startDate, endDate, cityId, portId, notAvailable } = body;

  // Not-available uses 7-day TTL; normal availability uses per-date expiry (computed server-side in apply_projection)
  const notAvailableExpiresAt = new Date();
  notAvailableExpiresAt.setDate(notAvailableExpiresAt.getDate() + 7);

  // "Not available" path: explicit declaration, no dates or city needed
  if (notAvailable) {
    // Validate cityId if provided
    if (cityId) {
      const { data: cityCheck } = await serviceClient
        .from('cities')
        .select('id')
        .eq('id', cityId)
        .single();

      if (!cityCheck) {
        return NextResponse.json({ error: 'Invalid cityId' }, { status: 400 });
      }
    }

    // Validate portId belongs to cityId if both provided
    if (portId && cityId) {
      const { data: portCheck } = await serviceClient
        .from('ports')
        .select('id, city_id')
        .eq('id', portId)
        .single();

      if (!portCheck) {
        return NextResponse.json({ error: 'Invalid portId' }, { status: 400 });
      }

      if (portCheck.city_id !== cityId) {
        return NextResponse.json(
          { error: 'Port does not belong to the selected city' },
          { status: 400 },
        );
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    try {
      await appendEvent(serviceClient, {
        eventType: 'AVAILABILITY.SET',
        aggregateId: user.id,
        aggregateType: 'person',
        roleContext: 'crew',
        payload: {
          start_date: todayStr,
          end_date: todayStr,
          expires_at: notAvailableExpiresAt.toISOString(),
          city_id: cityId ?? null,
          port_id: portId ?? null,
          not_available: true,
        },
        personId: user.id,
      });

      return NextResponse.json({
        success: true,
        notAvailable: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set availability';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Normal availability path: cityId required
  if (!cityId) {
    return NextResponse.json({ error: 'cityId is required' }, { status: 400 });
  }

  // Validate portId belongs to cityId if both provided
  if (portId) {
    const { data: portCheck } = await serviceClient
      .from('ports')
      .select('id, city_id')
      .eq('id', portId)
      .single();

    if (!portCheck) {
      return NextResponse.json({ error: 'Invalid portId' }, { status: 400 });
    }

    if (portCheck.city_id !== cityId) {
      return NextResponse.json(
        { error: 'Port does not belong to the selected city' },
        { status: 400 },
      );
    }
  }

  // Normal availability path: dates required
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  if (end < start) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 });
  }

  // Enforce 14-day rolling window using UTC date strings to avoid timezone issues
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxDateObj = new Date();
  maxDateObj.setUTCDate(maxDateObj.getUTCDate() + 13);
  const maxDateStr = maxDateObj.toISOString().slice(0, 10);

  if (startDate < todayStr) {
    return NextResponse.json({ error: 'Cannot set availability for past dates' }, { status: 400 });
  }

  if (endDate > maxDateStr) {
    return NextResponse.json(
      { error: 'Availability can only be set within the next 14 days' },
      { status: 400 },
    );
  }

  // Validate cityId exists
  const { data: cityCheck } = await serviceClient
    .from('cities')
    .select('id')
    .eq('id', cityId)
    .single();

  if (!cityCheck) {
    return NextResponse.json({ error: 'Invalid cityId' }, { status: 400 });
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  try {
    await appendEvent(serviceClient, {
      eventType: 'AVAILABILITY.SET',
      aggregateId: user.id,
      aggregateType: 'person',
      roleContext: 'crew',
      payload: {
        start_date: startDate,
        end_date: endDate,
        city_id: cityId,
        port_id: portId ?? null,
      },
      personId: user.id,
    });

    return NextResponse.json({
      success: true,
      daysSet: diffDays,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set availability';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/availability
 * Clear availability for specific dates.
 *
 * Body: { dates: string[] } — array of YYYY-MM-DD
 */
export async function DELETE(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  if (!['crew', 'employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Invalid hat' }, { status: 403 });
  }
  const roleContext = person.current_hat as 'crew' | 'employer' | 'agent';

  const body = await request.json().catch(() => ({}));
  const { dates, clearAll } = body;

  // Clear all availability — treated as "not available" through the ledger
  if (clearAll) {
    // Get the user's last known city for the not-available marker
    const { data: lastWindow } = await serviceClient
      .from('availability_windows')
      .select('city_id')
      .eq('person_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const cityId = lastWindow?.city_id ?? null;

    const clearExpiresAt = new Date();
    clearExpiresAt.setDate(clearExpiresAt.getDate() + 7);
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      await appendEvent(serviceClient, {
        eventType: 'AVAILABILITY.SET',
        aggregateId: user.id,
        aggregateType: 'person',
        roleContext,
        payload: {
          start_date: todayStr,
          end_date: todayStr,
          expires_at: clearExpiresAt.toISOString(),
          city_id: cityId,
          not_available: true,
        },
        personId: user.id,
      });

      return NextResponse.json({ success: true, cleared: 'all' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear availability';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json({ error: 'dates array is required' }, { status: 400 });
  }

  const invalidDate = dates.some((date) => {
    if (typeof date !== 'string') {
      return true;
    }

    return Number.isNaN(new Date(date).getTime());
  });

  if (invalidDate) {
    return NextResponse.json(
      { error: 'All dates must be valid YYYY-MM-DD strings' },
      { status: 400 },
    );
  }

  const { error } = await serviceClient.rpc('clear_availability_dates', {
    p_person_id: user.id,
    p_dates: dates,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, cleared: dates.length });
}
