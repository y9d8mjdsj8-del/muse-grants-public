-- Server-only digest cursor and immutable daily outbox. Never exposed to browser clients.
create table if not exists grants.email_digest_cursor (
  user_id uuid primary key references auth.users(id) on delete cascade,
  checked_at timestamptz not null default now()
);
create table if not exists grants.email_digest_outbox (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  cutoff timestamptz not null,
  payload jsonb not null,
  events jsonb not null,
  sent_at timestamptz,
  provider_id text,
  primary key (user_id, day)
);
alter table grants.email_digest_cursor enable row level security;
alter table grants.email_digest_outbox enable row level security;
revoke all on grants.email_digest_cursor, grants.email_digest_outbox from public, anon, authenticated;
grant all on grants.email_digest_cursor, grants.email_digest_outbox to service_role;
