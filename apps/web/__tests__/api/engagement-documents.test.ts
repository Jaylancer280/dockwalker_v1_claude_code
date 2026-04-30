import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as listDocs } from '@/app/api/messages/[engagementId]/documents/route';
import { POST as finalizeDocs } from '@/app/api/messages/[engagementId]/documents/finalize/route';
import { GET as downloadDoc } from '@/app/api/messages/[engagementId]/documents/[documentId]/download/route';
import { DELETE as deleteDoc } from '@/app/api/messages/[engagementId]/documents/[documentId]/route';

/**
 * Audit P1-T1 (2026-04-30): 4 of the 5 document-route tests called out
 * in the audit (list / finalize / download / delete). Upload is omitted
 * here — its FormData + MIME + magic-byte + Upstash rate-limit mocking
 * surface is substantial enough to warrant its own focused test file.
 */

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: () => mockRequireDomainUser(),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockSupabaseFrom = vi.fn();
const mockServiceFrom = vi.fn();
const mockServiceStorage = vi.fn();

function chain(data: unknown, error: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.in = vi.fn().mockReturnValue(self);
  self.order = vi.fn().mockReturnValue(self);
  self.update = vi.fn().mockReturnValue(self);
  self.single = vi.fn().mockResolvedValue({ data, error });
  self.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  self.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return self;
}

function guard(userId = 'crew-1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockSupabaseFrom },
      serviceClient: { from: mockServiceFrom, storage: { from: mockServiceStorage } },
    },
  };
}

const ENGAGEMENT_ACTIVE = {
  id: 'eng-1',
  crew_person_id: 'crew-1',
  employer_person_id: 'employer-1',
  status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// GET /documents (list)
// =============================================================================
describe('GET /api/messages/[engagementId]/documents', () => {
  const params = { params: Promise.resolve({ engagementId: 'eng-1' }) };

  it('404s when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard());
    mockSupabaseFrom.mockReturnValueOnce(chain(null));
    const res = await listDocs(new Request('http://localhost/'), params);
    expect(res.status).toBe(404);
  });

  it('403s when caller is not a participant', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('stranger'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    const res = await listDocs(new Request('http://localhost/'), params);
    expect(res.status).toBe(403);
  });

  it('returns the document list when caller is the crew participant', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockSupabaseFrom.mockReturnValueOnce(
      chain(
        [
          {
            id: 'doc-1',
            file_name: 'safety.pdf',
            file_size_bytes: 12345,
            mime_type: 'application/pdf',
            uploader_person_id: 'employer-1',
            expires_at: '2026-05-30T00:00:00Z',
            deleted_at: null,
            message_id: 'msg-1',
            created_at: '2026-04-30T00:00:00Z',
          },
        ],
      ),
    );
    const res = await listDocs(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].file_name).toBe('safety.pdf');
  });
});

// =============================================================================
// POST /documents/finalize
// =============================================================================
describe('POST /api/messages/[engagementId]/documents/finalize', () => {
  const params = { params: Promise.resolve({ engagementId: 'eng-1' }) };
  function makeRequest(body: unknown): Request {
    return new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('400s when documentIds is missing or empty', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard());
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    const res = await finalizeDocs(makeRequest({ documentIds: [] }), params);
    expect(res.status).toBe(400);
  });

  it('400s when document belongs to a different engagement', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard());
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chain([
        {
          id: 'doc-1',
          engagement_id: 'eng-OTHER',
          uploader_person_id: 'crew-1',
          message_id: null,
        },
      ]),
    );
    const res = await finalizeDocs(makeRequest({ documentIds: ['doc-1'] }), params);
    expect(res.status).toBe(400);
  });

  it('403s when document was uploaded by a different user', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chain([
        {
          id: 'doc-1',
          engagement_id: 'eng-1',
          uploader_person_id: 'employer-1',
          message_id: null,
        },
      ]),
    );
    const res = await finalizeDocs(makeRequest({ documentIds: ['doc-1'] }), params);
    expect(res.status).toBe(403);
  });

  it('400s when document already finalized (message_id set)', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chain([
        {
          id: 'doc-1',
          engagement_id: 'eng-1',
          uploader_person_id: 'crew-1',
          message_id: 'msg-existing',
        },
      ]),
    );
    const res = await finalizeDocs(makeRequest({ documentIds: ['doc-1'] }), params);
    expect(res.status).toBe(400);
  });

  it('fires MESSAGE.SENT with documents type on happy path', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chain([
        {
          id: 'doc-1',
          engagement_id: 'eng-1',
          uploader_person_id: 'crew-1',
          message_id: null,
        },
        {
          id: 'doc-2',
          engagement_id: 'eng-1',
          uploader_person_id: 'crew-1',
          message_id: null,
        },
      ]),
    );
    // Update call to link message_id (returns nothing meaningful)
    mockServiceFrom.mockReturnValueOnce(chain(null));
    const res = await finalizeDocs(
      makeRequest({ documentIds: ['doc-1', 'doc-2'] }),
      params,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.documentCount).toBe(2);
    expect(body.messageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.eventType).toBe('MESSAGE.SENT');
    expect(args.payload.message_type).toBe('documents');
    expect(args.payload.document_count).toBe(2);
  });
});

// =============================================================================
// GET /documents/[documentId]/download
// =============================================================================
describe('GET /api/messages/[engagementId]/documents/[documentId]/download', () => {
  const params = {
    params: Promise.resolve({ engagementId: 'eng-1', documentId: 'doc-1' }),
  };

  it('404s when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard());
    mockSupabaseFrom.mockReturnValueOnce(chain(null));
    const res = await downloadDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(404);
  });

  it('403s when non-participant', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('stranger'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    const res = await downloadDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(403);
  });

  it('410s when document was deleted by uploader', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chain({
        storage_path: 'eng-1/doc-1.pdf',
        file_name: 'x.pdf',
        mime_type: 'application/pdf',
        expires_at: '2099-01-01T00:00:00Z',
        deleted_at: '2026-04-29T00:00:00Z',
      }),
    );
    const res = await downloadDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(410);
  });

  it('410s when document expired', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chain({
        storage_path: 'eng-1/doc-1.pdf',
        file_name: 'x.pdf',
        mime_type: 'application/pdf',
        expires_at: '2020-01-01T00:00:00Z',
        deleted_at: null,
      }),
    );
    const res = await downloadDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(410);
  });

  it('returns signed URL with no-store cache header on happy path', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockSupabaseFrom.mockReturnValueOnce(chain(ENGAGEMENT_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chain({
        storage_path: 'eng-1/doc-1.pdf',
        file_name: 'safety.pdf',
        mime_type: 'application/pdf',
        expires_at: '2099-01-01T00:00:00Z',
        deleted_at: null,
      }),
    );
    mockServiceStorage.mockReturnValueOnce({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.url/eng-1/doc-1.pdf' },
        error: null,
      }),
    });
    const res = await downloadDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body.url).toBe('https://signed.url/eng-1/doc-1.pdf');
    expect(body.fileName).toBe('safety.pdf');
  });
});

// =============================================================================
// DELETE /documents/[documentId]
// =============================================================================
describe('DELETE /api/messages/[engagementId]/documents/[documentId]', () => {
  const params = {
    params: Promise.resolve({ engagementId: 'eng-1', documentId: 'doc-1' }),
  };

  it('404s when document not found', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard());
    mockServiceFrom.mockReturnValueOnce(chain(null));
    const res = await deleteDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(404);
  });

  it('404s when already-deleted', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockServiceFrom.mockReturnValueOnce(
      chain({
        id: 'doc-1',
        uploader_person_id: 'crew-1',
        storage_path: 'p/doc-1',
        deleted_at: '2026-04-29T00:00:00Z',
        engagement_id: 'eng-1',
      }),
    );
    const res = await deleteDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(404);
  });

  it('403s when caller is not the uploader', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('stranger'));
    mockServiceFrom.mockReturnValueOnce(
      chain({
        id: 'doc-1',
        uploader_person_id: 'crew-1',
        storage_path: 'p/doc-1',
        deleted_at: null,
        engagement_id: 'eng-1',
      }),
    );
    const res = await deleteDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(403);
  });

  it('hard-deletes from storage + soft-deletes metadata on happy path', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guard('crew-1'));
    mockServiceFrom.mockReturnValueOnce(
      chain({
        id: 'doc-1',
        uploader_person_id: 'crew-1',
        storage_path: 'eng-1/doc-1.pdf',
        deleted_at: null,
        engagement_id: 'eng-1',
      }),
    );
    const storageRemove = vi.fn().mockResolvedValue({ data: null, error: null });
    mockServiceStorage.mockReturnValueOnce({ remove: storageRemove });
    // Soft-delete UPDATE
    mockServiceFrom.mockReturnValueOnce(chain(null));

    const res = await deleteDoc(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    expect(storageRemove).toHaveBeenCalledWith(['eng-1/doc-1.pdf']);
  });
});
