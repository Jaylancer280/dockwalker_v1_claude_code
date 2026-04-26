-- Rollback for 00122. Re-applies the 00083 definitions verbatim — no
-- hidden/pending filter, NDA + owner + engagement reveal only. Operators
-- should re-run 00083_fix_nda_vessel_name.sql to restore the previous
-- behaviour.

do $$
begin
  raise notice
    'Rollback for 00122: re-apply migration 00083_fix_nda_vessel_name.sql to restore the pre-Wave-F definitions of get_vessel_public + get_vessels_public_batch (no hidden/pending filter).';
end $$;
