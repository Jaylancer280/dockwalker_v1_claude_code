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

function makeFile(type: string, sizeBytes: number): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], 'avatar.jpg', { type });
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
    expect(body.avatar_url).toBe('https://storage.example.com/avatars/u1/avatar.jpg');
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'PROFILE.UPDATED',
        payload: { avatar_url: 'https://storage.example.com/avatars/u1/avatar.jpg' },
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
