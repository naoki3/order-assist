-- ============================================================================
-- Logical delete: disable every account EXCEPT the demo account.
--
-- Disabled accounts are flagged with user_profiles.is_active = false and are
-- blocked at login by the `login` server action (src/app/actions/auth.ts),
-- which rejects any auth user whose profile has is_active = false.
--
-- Nothing is actually deleted, so this is fully reversible (see bottom).
--
-- HOW TO RUN:
--   1. Replace 'demo@example.com' below with the real demo account email.
--   2. Run in the Supabase SQL editor (service role bypasses RLS).
-- ============================================================================

-- (1) Flag existing profiles that have a login account (sub-users).
update user_profiles p
set is_active = false
from auth.users u
where p.auth_user_id = u.id
  and u.email is distinct from 'demo@example.com';

-- (2) Tenant owners sign up by email and have no self-profile, so flagging
--     them needs a minimal disabled profile keyed by their auth_user_id.
insert into user_profiles (user_id, auth_user_id, name, is_active)
select u.id, u.id, coalesce(u.email, 'user'), false
from auth.users u
where u.email is distinct from 'demo@example.com'
  and not exists (
    select 1 from user_profiles p where p.auth_user_id = u.id
  )
on conflict (auth_user_id) do update set is_active = false;

-- Verify which accounts remain able to log in:
--   select u.email, p.is_active
--   from auth.users u
--   left join user_profiles p on p.auth_user_id = u.id
--   order by u.email;

-- ----------------------------------------------------------------------------
-- TO RE-ENABLE an account later, set its flag back to active, e.g.:
--   update user_profiles p set is_active = true
--   from auth.users u
--   where p.auth_user_id = u.id and u.email = 'someone@example.com';
-- ----------------------------------------------------------------------------
