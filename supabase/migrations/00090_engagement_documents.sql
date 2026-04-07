-- =============================================================================
-- Migration 00090: Ephemeral document exchange
--
-- 1. Create engagement_documents table for 48-hour file sharing
-- 2. Create engagement-documents storage bucket (private)
-- 3. Storage RLS policies
-- =============================================================================

-- 1. Table
create table public.engagement_documents (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.active_engagements(id),
  message_id uuid references public.messages(id),
  uploader_person_id uuid not null references public.persons(id),
  file_name text not null,
  file_size_bytes integer not null,
  mime_type text not null,
  storage_path text not null,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_engagement_documents_expires
  on public.engagement_documents (expires_at)
  where deleted_at is null;

create index idx_engagement_documents_engagement
  on public.engagement_documents (engagement_id);

-- RLS
alter table public.engagement_documents enable row level security;

create policy "Engagement participants can read documents"
  on public.engagement_documents for select
  using (
    exists (
      select 1 from public.active_engagements ae
      where ae.id = engagement_id
      and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
    )
  );

create policy "Engagement participants can insert documents"
  on public.engagement_documents for insert
  with check (
    uploader_person_id = auth.uid()
    and exists (
      select 1 from public.active_engagements ae
      where ae.id = engagement_id
      and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
    )
  );

create policy "Uploader can update own documents"
  on public.engagement_documents for update
  using (uploader_person_id = auth.uid())
  with check (uploader_person_id = auth.uid());

-- 2. Storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'engagement-documents', 'engagement-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 3. Storage policies
-- INSERT: engagement participants can upload to engagement folder
create policy "Engagement participants can upload documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'engagement-documents'
    and exists (
      select 1 from public.active_engagements ae
      where ae.id::text = (storage.foldername(name))[1]
      and (ae.crew_person_id = auth.uid() or ae.employer_person_id = auth.uid())
    )
  );

-- DELETE: service role can delete files (cron cleanup)
create policy "Service role can delete engagement documents"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'engagement-documents');
