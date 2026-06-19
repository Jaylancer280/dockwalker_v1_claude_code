-- =============================================================================
-- Rollback 00043: pgvector + MCA Document Chunks
-- =============================================================================
drop function if exists public.match_mca_documents(extensions.vector(1536), int, float);
drop policy if exists "Authenticated users can read MCA chunks" on public.mca_document_chunks;
drop index if exists public.mca_chunks_embedding_idx;
drop table if exists public.mca_document_chunks;
-- Note: do NOT drop pgvector extension — other things may depend on it
