import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGenerateEmbedding = vi.fn();
vi.mock('@/lib/advisor/embeddings', () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

import { searchMcaDocs } from '@/lib/advisor/rag';

describe('searchMcaDocs — corpus ready guard', () => {
  const originalEnv = process.env.DOCKY_CORPUS_READY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DOCKY_CORPUS_READY = originalEnv;
    } else {
      delete process.env.DOCKY_CORPUS_READY;
    }
  });

  it('returns empty array without calling OpenAI when DOCKY_CORPUS_READY is not true', async () => {
    process.env.DOCKY_CORPUS_READY = 'false';

    const mockSupabase = { rpc: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await searchMcaDocs('What STCW do I need?', mockSupabase as any);

    expect(result).toEqual([]);
    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns empty array when DOCKY_CORPUS_READY is undefined', async () => {
    delete process.env.DOCKY_CORPUS_READY;

    const mockSupabase = { rpc: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await searchMcaDocs('What STCW do I need?', mockSupabase as any);

    expect(result).toEqual([]);
    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
  });

  it('calls embedding when DOCKY_CORPUS_READY is true', async () => {
    process.env.DOCKY_CORPUS_READY = 'true';
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ content: 'test', source_document: 'MIN 599', source_url: null, section_title: null, similarity: 0.85 }],
        error: null,
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await searchMcaDocs('What STCW do I need?', mockSupabase as any);

    expect(result).toHaveLength(1);
    expect(mockGenerateEmbedding).toHaveBeenCalledOnce();
    expect(mockSupabase.rpc).toHaveBeenCalledOnce();
  });
});
