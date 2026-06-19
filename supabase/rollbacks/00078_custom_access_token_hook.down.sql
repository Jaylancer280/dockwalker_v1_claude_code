-- Rollback: remove custom access token hook
-- NOTE: Also disable the hook in Supabase Dashboard: Auth → Hooks → Custom Access Token → Disable

-- Revoke the grants first
revoke execute on function public.custom_access_token_hook from supabase_auth_admin;

-- Drop the function
drop function if exists public.custom_access_token_hook(jsonb);
