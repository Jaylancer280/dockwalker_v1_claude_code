import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';
import { appendEvent } from '@dockwalker/db';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Look up the user's current hat — present only after onboarding has
 * created the persons row. Pre-onboarding callers get null and skip the
 * PROFILE.UPDATED event (the projection row doesn't exist yet; the
 * avatar_url is rolled into the onboarding RPC's initial profile insert
 * via the onboarding page's `avatarUrl` state).
 */
async function getCurrentHat(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<'crew' | 'employer' | 'agent' | null> {
  const { data } = await serviceClient
    .from('persons')
    .select('current_hat')
    .eq('id', userId)
    .maybeSingle();
  const hat = data?.current_hat as string | undefined;
  if (hat === 'crew' || hat === 'employer' || hat === 'agent') return hat;
  return null;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/** Validate file content matches declared MIME type via magic bytes */
function validateMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (bytes.length < 12) return false;
  switch (mimeType) {
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    case 'image/webp':
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

/**
 * POST /api/profile/avatar
 * Upload a profile avatar. Accepts multipart form data with a single file.
 */
export async function POST(request: Request) {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const roleContext = await getCurrentHat(serviceClient, user.id);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be 2MB or smaller' }, { status: 400 });
    }

    // 1. Read buffer and validate magic bytes BEFORE touching storage
    const buffer = Buffer.from(await file.arrayBuffer());

    if (!validateMagicBytes(new Uint8Array(buffer), file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared type' },
        { status: 400 },
      );
    }

    // 2. Upload new file first
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const storagePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 3. Only after upload succeeds, remove old files with different extensions
    const { data: existing } = await supabase.storage.from('avatars').list(user.id);

    if (existing && existing.length > 0) {
      const oldPaths = existing
        .filter((f) => `${user.id}/${f.name}` !== storagePath)
        .map((f) => `${user.id}/${f.name}`);
      if (oldPaths.length > 0) {
        await supabase.storage.from('avatars').remove(oldPaths);
      }
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    if (roleContext) {
      await appendEvent(serviceClient, {
        eventType: 'PROFILE.UPDATED',
        aggregateId: user.id,
        aggregateType: 'person',
        roleContext,
        payload: { avatar_url: avatarUrl },
        personId: user.id,
      });
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove the user's profile avatar.
 */
export async function DELETE() {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const roleContext = await getCurrentHat(serviceClient, user.id);

  try {
    // Remove all avatar files for this user
    const { data: existing } = await supabase.storage.from('avatars').list(user.id);

    if (existing && existing.length > 0) {
      const paths = existing.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from('avatars').remove(paths);
    }

    if (roleContext) {
      await appendEvent(serviceClient, {
        eventType: 'PROFILE.UPDATED',
        aggregateId: user.id,
        aggregateType: 'person',
        roleContext,
        payload: { avatar_url: null },
        personId: user.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
