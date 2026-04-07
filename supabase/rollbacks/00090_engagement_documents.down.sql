-- Rollback 00090: Drop ephemeral document exchange
drop policy if exists "Service role can delete engagement documents" on storage.objects;
drop policy if exists "Engagement participants can upload documents" on storage.objects;
delete from storage.buckets where id = 'engagement-documents';
drop policy if exists "Uploader can update own documents" on public.engagement_documents;
drop policy if exists "Engagement participants can insert documents" on public.engagement_documents;
drop policy if exists "Engagement participants can read documents" on public.engagement_documents;
drop index if exists idx_engagement_documents_engagement;
drop index if exists idx_engagement_documents_expires;
drop table if exists public.engagement_documents;
