-- Rollback for 00113_locations_osm_fallback_v1.sql
--
-- Removes the gap-fill cities, then drops the source/coords/osm_place_id
-- columns from cities and the source column from ports.

-- Drop gap-fill rows by (region_id, name) — only the ones this migration added.
delete from public.cities where region_id = '2f8a6da0-fa61-5641-9091-5ebe3b92280f' and name = 'Valletta';
delete from public.cities where region_id = 'e0abeaa4-1552-5876-892b-b21dc0399daf' and name = 'Tortola';
delete from public.cities where region_id = 'af36c471-8385-5649-aa0f-fc89b052dc68' and name in ('Porto Cervo','Portofino','Capri');
delete from public.cities where region_id = '489b3d7a-baeb-5228-849a-fc18a1612ac4' and name = 'Split';
delete from public.cities where region_id = 'e43708d2-71e3-5fd7-87ce-7c7dbe08e185' and name = 'Phuket';
delete from public.cities where region_id = '04a42fdd-167b-5dc2-99cc-b33e3e438b51' and name in ('Monte Carlo','La Condamine');
delete from public.cities where region_id = '9a233adf-96fe-55ff-965a-17ae971078da' and name = 'Vilamoura';

drop index if exists public.idx_cities_osm_place_id;

alter table public.cities drop constraint if exists cities_source_check;
alter table public.cities drop column if exists source;
alter table public.cities drop column if exists latitude;
alter table public.cities drop column if exists longitude;
alter table public.cities drop column if exists osm_place_id;

alter table public.ports drop constraint if exists ports_source_check;
alter table public.ports drop column if exists source;
