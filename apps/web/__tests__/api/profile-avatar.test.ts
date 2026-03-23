import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST, DELETE } from '@/app/api/profile/avatar/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageList = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: {
        storage: {
          from: () => ({
            upload: mockStorageUpload,
            remove: mockStorageRemove,
            list: mockStorageList,
            getPublicUrl: mockStorageGetPublicUrl,
          }),
        },
      },
      serviceClient: { rpc: vi.fn() },
    },
  };
}

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeFile(type: string, sizeBytes: number): File {
  const buffer = new Uint8Array(Math.max(sizeBytes, 12));
  // Write valid magic bytes for the declared type
  if (type === 'image/jpeg') buffer.set(JPEG_HEADER);
  else if (type === 'image/png') buffer.set(PNG_HEADER);
  else if (type === 'image/webp') {
    buffer.set([0x52, 0x49, 0x46, 0x46]); // RIFF
    buffer.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  }
  return new File([buffer], 'avatar.jpg', { type });
}

function makeFileWithWrongContent(declaredType: string): File {
  // File declares JPEG but has PNG magic bytes
  const buffer = new Uint8Array(64);
  buffer.set(PNG_HEADER);
  return new File([buffer], 'avatar.jpg', { type: declaredType });
}

describe('POST /api/profile/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageList.mockResolvedValue({ data: [] });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.example.com/avatars/u1/avatar.jpg' },
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const formData = new FormData();
    formData.append('file', makeFile('image/jpeg', 1000));
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const formData = new FormData();
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No file');
  });

  it('returns 400 for wrong MIME type', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const formData = new FormData();
    formData.append('file', makeFile('image/gif', 1000));
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('JPEG, PNG, or WebP');
  });

  it('returns 400 for oversized file', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const formData = new FormData();
    formData.append('file', makeFile('image/jpeg', 3 * 1024 * 1024));
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('2MB');
  });

  it('returns 400 when file content does not match declared MIME type', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const formData = new FormData();
    formData.append('file', makeFileWithWrongContent('image/jpeg'));
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('does not match');
  });

  it('does not delete old avatar when magic bytes are invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockStorageList.mockResolvedValue({ data: [{ name: 'avatar.jpg' }] });

    const formData = new FormData();
    formData.append('file', makeFileWithWrongContent('image/jpeg'));
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('does not delete old avatar when upload fails', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockStorageList.mockResolvedValue({ data: [{ name: 'avatar.png' }] });
    mockStorageUpload.mockResolvedValue({ error: { message: 'Storage full' } });

    const formData = new FormData();
    formData.append('file', makeFile('image/jpeg', 1000));
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('uploads successfully and returns avatar_url', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const formData = new FormData();
    formData.append('file', makeFile('image/jpeg', 1000));
    const req = new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.avatar_url).toMatch(/^https:\/\/storage\.example\.com\/avatars\/u1\/avatar\.jpg\?t=\d+$/);
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'PROFILE.UPDATED',
        payload: { avatar_url: expect.stringMatching(/^https:\/\/storage\.example\.com\/avatars\/u1\/avatar\.jpg\?t=\d+$/) },
      }),
    );
  });
});

describe('DELETE /api/profile/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageList.mockResolvedValue({ data: [{ name: 'avatar.jpg' }] });
    mockStorageRemove.mockResolvedValue({ error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it('deletes successfully', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'PROFILE.UPDATED',
        payload: { avatar_url: null },
      }),
    );
  });
});
