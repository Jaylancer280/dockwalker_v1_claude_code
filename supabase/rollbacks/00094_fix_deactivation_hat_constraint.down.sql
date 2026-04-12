-- Rollback 00094: Restore apply_projection from migration 00092
-- (reverts PERSON.DEACTIVATED handler back to setting current_hat='deactivated')
-- Note: this will re-introduce the CHECK constraint violation on deactivation.
-- The full apply_projection body from 00092 is identical except for the one line changed.

-- To roll back: re-apply migration 00092's apply_projection function.
-- Since 00094 only changed one line in the function body, restoring 00092's
-- version fully reverts the change.
