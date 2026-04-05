-- =============================================================================
-- Migration 00084: Lower MCA match threshold from 0.7 to 0.6
--
-- Corpus is small (756 chunks from 16 curated maritime PDFs). Best smoke test
-- similarity was 0.678 — below the 0.7 threshold. With a small curated corpus,
-- 0.6 is appropriate; every document is relevant and false positives are unlikely.
-- =============================================================================

create or replace function public.match_mca_documents(
  query_embedding extensions.vector(1536),
  match_count int default 5,
  match_threshold float default 0.6
)
returns table (
  id uuid,
  content text,
  source_document text,
  source_url text,
  section_title text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    mca.id,
    mca.content,
    mca.source_document,
    mca.source_url,
    mca.section_title,
    1 - (mca.embedding <=> query_embedding) as similarity
  from public.mca_document_chunks mca
  where 1 - (mca.embedding <=> query_embedding) > match_threshold
  order by mca.embedding <=> query_embedding
  limit match_count;
end;
$$;
