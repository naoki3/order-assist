create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- Allow anonymous role to read users for login verification
create policy "allow_login"
  on users for select
  to anon
  using (true);
