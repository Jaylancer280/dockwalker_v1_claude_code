-- Rollback 00084: Restore MCA match threshold to 0.7

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
