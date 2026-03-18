import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from './embeddings';

export interface MCAChunk {
  content: string;
  source_document: string;
  source_url: string | null;
  section_title: string | null;
  similarity: number;
}

export async function searchMcaDocs(
  query: string,
  supabase: SupabaseClient,
  limit?: number,
): Promise<MCAChunk[]> {
  try {
    const embedding = await generateEmbedding(query);
    const { data, error } = await supabase.rpc('match_mca_documents', {
      query_embedding: JSON.stringify(embedding),
      match_count: limit ?? 5,
      match_threshold: 0.7,
    });
    if (error || !data) return [];
    return data as MCAChunk[];
  } catch {
    return [];
  }
}
