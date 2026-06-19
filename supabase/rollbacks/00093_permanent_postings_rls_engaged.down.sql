-- Rollback 00093: Restore original permanent_postings SELECT policy (no engagement-based access)

drop policy "Users can read active/in_negotiation or own or engaged permanent postings"
  on public.permanent_postings;

create policy "Users can read active/in_negotiation or own permanent postings"
  on public.permanent_postings for select
  to authenticated
  using (status in ('active', 'in_negotiation') or employer_person_id = auth.uid());
