-- Migration 00093: Allow engaged crew/employer to read permanent postings regardless of status
--
-- Problem: The SELECT policy on permanent_postings only allows crew to see postings
-- with status 'active' or 'in_negotiation'. When a posting moves to 'filled' or 'cancelled',
-- crew lose access — breaking chat summary cards, messages list job context, and kebab menu actions.
--
-- Fix: Add a subquery exception for users who have an active_engagement referencing the posting.
-- Indexes: idx_engagements_crew (00003), idx_engagements_employer (00003), idx_engagements_permanent (00059).

drop policy "Users can read active/in_negotiation or own permanent postings"
  on public.permanent_postings;

create policy "Users can read active/in_negotiation or own or engaged permanent postings"
  on public.permanent_postings for select
  to authenticated
  using (
    status in ('active', 'in_negotiation')
    or employer_person_id = auth.uid()
    or id in (
      select permanent_posting_id
      from public.active_engagements
      where (crew_person_id = auth.uid() or employer_person_id = auth.uid())
        and permanent_posting_id is not null
    )
  );
