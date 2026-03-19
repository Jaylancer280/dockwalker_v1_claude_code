import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

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
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

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

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const storagePath = `${user.id}/avatar.${ext}`;

  // Remove any existing avatar files for this user (different extension)
  const { data: existing } = await supabase.storage.from('avatars').list(user.id);

  if (existing && existing.length > 0) {
    const paths = existing.map((f) => `${user.id}/${f.name}`);
    await supabase.storage.from('avatars').remove(paths);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!validateMagicBytes(new Uint8Array(buffer), file.type)) {
    return NextResponse.json(
      { error: 'File content does not match declared type' },
      { status: 400 },
    );
  }

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  const avatarUrl = urlData.publicUrl;

  await appendEvent(serviceClient, {
    eventType: 'PROFILE.UPDATED',
    aggregateId: user.id,
    aggregateType: 'person',
    roleContext: person.current_hat as 'crew' | 'employer' | 'agent',
    payload: { avatar_url: avatarUrl },
    personId: user.id,
  });

  return NextResponse.json({ avatar_url: avatarUrl });
}

/**
 * DELETE /api/profile/avatar
 * Remove the user's profile avatar.
 */
export async function DELETE() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  // Remove all avatar files for this user
  const { data: existing } = await supabase.storage.from('avatars').list(user.id);

  if (existing && existing.length > 0) {
    const paths = existing.map((f) => `${user.id}/${f.name}`);
    await supabase.storage.from('avatars').remove(paths);
  }

  await appendEvent(serviceClient, {
    eventType: 'PROFILE.UPDATED',
    aggregateId: user.id,
    aggregateType: 'person',
    roleContext: person.current_hat as 'crew' | 'employer' | 'agent',
    payload: { avatar_url: null },
    personId: user.id,
  });

  return NextResponse.json({ success: true });
}
