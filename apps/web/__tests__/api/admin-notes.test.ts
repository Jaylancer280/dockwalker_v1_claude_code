import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import {
  GET as listNotes,
  POST as createNote,
} from '@/app/api/admin/users/[personId]/notes/route';
import { PATCH as editNote } from '@/app/api/admin/users/[personId]/notes/[noteId]/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockServiceFrom = vi.fn();

function adminGuard(adminId: string) {
  return {
    ok: true,
    value: {
      user: { id: adminId },
      person: { id: adminId, identity_type: 'crew', current_hat: 'employer', is_admin: true },
      profile: { person_id: adminId },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function makeListParams(personId: string) {
  return { params: Promise.resolve({ personId }) };
}

function makeEditParams(personId: string, noteId: string) {
  return { params: Promise.resolve({ personId, noteId }) };
}

function createReq(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/users/target-1/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function editReq(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/users/target-1/notes/note-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin notes API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await listNotes(new Request('http://localhost'), makeListParams('target-1'));
    expect(res.status).toBe(403);
  });

  it('GET lists notes in chronological order', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-1'));
    const rows = [
      {
        id: 'n1',
        person_id: 'target-1',
        admin_person_id: 'admin-1',
        content: 'first',
        created_at: '2026-04-21T10:00:00Z',
        updated_at: '2026-04-21T10:00:00Z',
        author: { person_id: 'admin-1', display_name: 'Alice' },
      },
      {
        id: 'n2',
        person_id: 'target-1',
        admin_person_id: null,
        content: 'second (orphan)',
        created_at: '2026-04-21T11:00:00Z',
        updated_at: '2026-04-21T11:00:00Z',
        author: null,
      },
    ];
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    });

    const res = await listNotes(new Request('http://localhost'), makeListParams('target-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toHaveLength(2);
    expect(body.notes[0].admin_display_name).toBe('Alice');
    expect(body.notes[1].admin_display_name).toBeNull();
  });

  it('POST rejects empty content', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-1'));
    const res = await createNote(createReq({ content: '' }), makeListParams('target-1'));
    expect(res.status).toBe(400);
  });

  it('POST rejects content over 4000 chars', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-1'));
    const tooLong = 'x'.repeat(4001);
    const res = await createNote(createReq({ content: tooLong }), makeListParams('target-1'));
    expect(res.status).toBe(400);
  });

  it('POST returns 404 when target user missing', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-1'));
    mockServiceFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));
    const res = await createNote(createReq({ content: 'note text' }), makeListParams('target-1'));
    expect(res.status).toBe(404);
  });

  it('POST creates note and returns 201', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-1'));
    // First call: target lookup → found
    // Second call: insert → returns new row
    let call = 0;
    mockServiceFrom.mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'target-1' }, error: null }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'new-note',
                admin_person_id: 'admin-1',
                content: 'note text',
                created_at: '2026-04-21T12:00:00Z',
                updated_at: '2026-04-21T12:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      };
    });
    const res = await createNote(createReq({ content: 'note text' }), makeListParams('target-1'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.note.id).toBe('new-note');
  });

  it('PATCH rejects edit by non-author', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-2'));
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'note-1', admin_person_id: 'admin-1', person_id: 'target-1' },
            error: null,
          }),
        }),
      }),
    });
    const res = await editNote(
      editReq({ content: 'edited' }),
      makeEditParams('target-1', 'note-1'),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('authoring admin');
  });

  it('PATCH allows edit by original author', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-1'));
    let call = 0;
    mockServiceFrom.mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'note-1', admin_person_id: 'admin-1', person_id: 'target-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'note-1',
                  admin_person_id: 'admin-1',
                  content: 'edited',
                  created_at: '2026-04-21T10:00:00Z',
                  updated_at: '2026-04-21T12:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    });
    const res = await editNote(
      editReq({ content: 'edited' }),
      makeEditParams('target-1', 'note-1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.note.content).toBe('edited');
  });

  it('PATCH returns 404 when note does not belong to target user', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard('admin-1'));
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'note-1', admin_person_id: 'admin-1', person_id: 'other-user' },
            error: null,
          }),
        }),
      }),
    });
    const res = await editNote(
      editReq({ content: 'edited' }),
      makeEditParams('target-1', 'note-1'),
    );
    expect(res.status).toBe(404);
  });
});
