create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

alter table users disable row level security;
