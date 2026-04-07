import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

vi.mock('@dockwalker/db', () => ({
  appendEvent: vi.fn().mockResolvedValue('ev1'),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockFrom = vi.fn();
const mockServiceFrom = vi.fn();
const mockStorage = {
  from: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url' }, error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  }),
};

function guardOk(userId = 'u1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      supabase: { from: mockFrom, storage: mockStorage },
      serviceClient: { from: mockServiceFrom, storage: mockStorage },
    },
  };
}

function chain(data: unknown, error: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.is = vi.fn().mockReturnValue(self);
  self.gte = vi.fn().mockReturnValue(self);
  self.in = vi.fn().mockReturnValue(self);
  self.order = vi.fn().mockReturnValue(self);
  self.single = vi.fn().mockResolvedValue({ data, error });
  self.insert = vi.fn().mockReturnValue(self);
  self.update = vi.fn().mockReturnValue(self);
  self.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve({ data, error, count: typeof data === 'number' ? data : null });
    return Promise.resolve({ data, error });
  });
  return self;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeParams = (engagementId: string, documentId?: string): any =>
  documentId
    ? { params: Promise.resolve({ engagementId, documentId }) }
    : { params: Promise.resolve({ engagementId }) };

import { POST as uploadRoute } from '@/app/api/messages/[engagementId]/documents/upload/route';
import { POST as finalizeRoute } from '@/app/api/messages/[engagementId]/documents/finalize/route';
import { GET as listRoute } from '@/app/api/messages/[engagementId]/documents/route';
import { GET as downloadRoute } from '@/app/api/messages/[engagementId]/documents/[documentId]/download/route';
import { DELETE as deleteRoute } from '@/app/api/messages/[engagementId]/documents/[documentId]/route';

function makeUploadRequest(file: File, engagementId = 'eng1') {
  const formData = new FormData();
  formData.append('file', file);
  return new Request(`http://localhost/api/messages/${engagementId}/documents/upload`, {
    method: 'POST',
    body: formData,
  });
}

// PDF magic bytes
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0, 0]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('Document exchange API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  describe('Upload', () => {
    it('returns 403 for non-participant', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'other', employer_person_id: 'other2', status: 'active' }),
      );
      const file = new File([PDF_BYTES], 'cert.pdf', { type: 'application/pdf' });
      const res = await uploadRoute(makeUploadRequest(file), makeParams('eng1'));
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid MIME type', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1', status: 'active' }),
      );
      mockServiceFrom.mockReturnValue(chain(null));
      const file = new File([new Uint8Array(20)], 'doc.exe', { type: 'application/octet-stream' });
      const res = await uploadRoute(makeUploadRequest(file), makeParams('eng1'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/PDF|JPEG|PNG|WebP/i);
    });

    it('returns 400 for oversize file', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1', status: 'active' }),
      );
      mockServiceFrom.mockReturnValue(chain(null));
      const bigBuffer = new Uint8Array(5 * 1024 * 1024); // 5MB
      bigBuffer.set(PDF_BYTES);
      const file = new File([bigBuffer], 'big.pdf', { type: 'application/pdf' });
      const res = await uploadRoute(makeUploadRequest(file), makeParams('eng1'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/4MB/);
    });

    it('returns 201 for valid PDF upload', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1', status: 'active' }),
      );
      // Rate limit check: count = 0
      const rateLimitChain = chain(null);
      rateLimitChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
        resolve({ data: null, error: null, count: 0 });
        return Promise.resolve({ data: null, error: null, count: 0 });
      });
      // Insert returns doc id
      const insertChain = chain({ id: 'doc1' });

      let serviceCallIdx = 0;
      mockServiceFrom.mockImplementation(() => {
        serviceCallIdx++;
        return serviceCallIdx === 1 ? rateLimitChain : insertChain;
      });

      const file = new File([PDF_BYTES], 'cert.pdf', { type: 'application/pdf' });
      const res = await uploadRoute(makeUploadRequest(file), makeParams('eng1'));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.documentId).toBe('doc1');
      expect(body.fileName).toBeDefined();
    });

    it('returns 400 for completed engagement', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1', status: 'completed' }),
      );
      const file = new File([PDF_BYTES], 'cert.pdf', { type: 'application/pdf' });
      const res = await uploadRoute(makeUploadRequest(file), makeParams('eng1'));
      expect(res.status).toBe(400);
    });
  });

  describe('Finalize', () => {
    it('links documents to message and returns 201', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1', status: 'active' }),
      );
      mockServiceFrom.mockReturnValue(
        chain([{ id: 'doc1', engagement_id: 'eng1', uploader_person_id: 'u1', message_id: null }]),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: ['doc1'] }),
      });
      const res = await finalizeRoute(req, makeParams('eng1'));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.documentCount).toBe(1);
    });

    it('rejects already-finalized documents', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1', status: 'active' }),
      );
      mockServiceFrom.mockReturnValue(
        chain([{ id: 'doc1', engagement_id: 'eng1', uploader_person_id: 'u1', message_id: 'msg1' }]),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: ['doc1'] }),
      });
      const res = await finalizeRoute(req, makeParams('eng1'));
      expect(res.status).toBe(400);
    });
  });

  describe('List', () => {
    it('returns documents for participant', async () => {
      const docs = [{ id: 'doc1', file_name: 'cert.pdf' }];
      mockFrom.mockImplementation((table: string) => {
        if (table === 'active_engagements') {
          return chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1' });
        }
        return chain(docs);
      });

      const req = new Request('http://localhost/api/messages/eng1/documents');
      const res = await listRoute(req, makeParams('eng1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.documents).toEqual(docs);
    });
  });

  describe('Download', () => {
    it('returns signed URL for active document', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1' }),
      );
      mockServiceFrom.mockReturnValue(
        chain({
          storage_path: 'eng1/file.pdf',
          file_name: 'cert.pdf',
          mime_type: 'application/pdf',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          deleted_at: null,
        }),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/doc1/download');
      const res = await downloadRoute(req, makeParams('eng1', 'doc1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBeDefined();
    });

    it('returns 410 for expired document', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1' }),
      );
      mockServiceFrom.mockReturnValue(
        chain({
          storage_path: 'eng1/file.pdf',
          file_name: 'cert.pdf',
          mime_type: 'application/pdf',
          expires_at: new Date(Date.now() - 86400000).toISOString(),
          deleted_at: null,
        }),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/doc1/download');
      const res = await downloadRoute(req, makeParams('eng1', 'doc1'));
      expect(res.status).toBe(410);
    });

    it('returns 410 for deleted document', async () => {
      mockFrom.mockReturnValue(
        chain({ id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1' }),
      );
      mockServiceFrom.mockReturnValue(
        chain({
          storage_path: 'eng1/file.pdf',
          file_name: 'cert.pdf',
          mime_type: 'application/pdf',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          deleted_at: new Date().toISOString(),
        }),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/doc1/download');
      const res = await downloadRoute(req, makeParams('eng1', 'doc1'));
      expect(res.status).toBe(410);
    });
  });

  describe('Delete', () => {
    it('uploader can delete their document', async () => {
      mockServiceFrom.mockReturnValue(
        chain({ id: 'doc1', uploader_person_id: 'u1', storage_path: 'eng1/file.pdf', deleted_at: null, engagement_id: 'eng1' }),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/doc1', { method: 'DELETE' });
      const res = await deleteRoute(req, makeParams('eng1', 'doc1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('returns 403 for non-uploader', async () => {
      mockServiceFrom.mockReturnValue(
        chain({ id: 'doc1', uploader_person_id: 'other', storage_path: 'eng1/file.pdf', deleted_at: null, engagement_id: 'eng1' }),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/doc1', { method: 'DELETE' });
      const res = await deleteRoute(req, makeParams('eng1', 'doc1'));
      expect(res.status).toBe(403);
    });

    it('returns 404 for already-deleted document', async () => {
      mockServiceFrom.mockReturnValue(
        chain({ id: 'doc1', uploader_person_id: 'u1', storage_path: 'eng1/file.pdf', deleted_at: new Date().toISOString(), engagement_id: 'eng1' }),
      );

      const req = new Request('http://localhost/api/messages/eng1/documents/doc1', { method: 'DELETE' });
      const res = await deleteRoute(req, makeParams('eng1', 'doc1'));
      expect(res.status).toBe(404);
    });
  });
});
