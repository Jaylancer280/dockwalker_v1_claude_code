-- =============================================================================
-- Migration 00043: pgvector Extension + MCA Document Chunks
--
-- 1. Enable pgvector extension
-- 2. Create mca_document_chunks table
-- 3. HNSW index for cosine similarity
-- 4. match_mca_documents RPC
-- 5. RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. pgvector extension
-- ---------------------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. MCA chunks table
-- ---------------------------------------------------------------------------
create table public.mca_document_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding extensions.vector(1536) not null,
  source_document text not null,
  source_url text,
  page_number int,
  section_title text,
  chunk_index int,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. HNSW index (preferred for <10K rows)
-- ---------------------------------------------------------------------------
create index mca_chunks_embedding_idx
  on public.mca_document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 4. Similarity search RPC
-- ---------------------------------------------------------------------------
create or replace function public.match_mca_documents(
  query_embedding extensions.vector(1536),
  match_count int default 5,
  match_threshold float default 0.7
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

-- ---------------------------------------------------------------------------
-- 5. RLS — service role writes, authenticated reads via RPC
-- ---------------------------------------------------------------------------
alter table public.mca_document_chunks enable row level security;

create policy "Authenticated users can read MCA chunks"
  on public.mca_document_chunks for select
  to authenticated
  using (true);
