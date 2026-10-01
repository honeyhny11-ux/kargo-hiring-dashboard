-- Kargo Hiring Dashboard: run this once in Supabase → SQL Editor → New query → Run.
-- Row Level Security is ON with no policies, so only the server (service-role key) can read or write.

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Identifiers (PII): stored here, never sent to Gemini.
  name text not null,
  email text not null default '',
  phone text not null default '',
  filename text not null,
  applied_role text not null check (applied_role in ('PM', 'SPM')),
  -- Pipeline state and AI output (content-derived only).
  status text not null default 'pending' check (status in ('pending', 'scoring', 'scored', 'error')),
  error text,
  brief text,
  strengths jsonb,
  concern text,
  pm_years_note text,
  -- Arjun's decision.
  decision text check (decision in ('INVITE', 'REJECT')),
  decided_at timestamptz
);

-- CV text with identifiers removed. This is the only CV data the AI sees.
create table if not exists candidate_content (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  content text not null
);

create table if not exists hires (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  role text not null check (role in ('PM', 'SPM')),
  rating text not null check (rating in ('Exceeds', 'Meets', 'Below')),
  profile text not null
);

create table if not exists rubric (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null check (role in ('PM', 'SPM')),
  version int not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  criteria jsonb not null,
  notes text not null default ''
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  role text not null check (role in ('PM', 'SPM')),
  rubric_id uuid not null references rubric(id),
  criteria jsonb not null,
  total numeric not null,
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW')),
  unique (candidate_id, role)
);

create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  kind text not null check (kind in ('INVITE', 'REJECT')),
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed', 'discarded')),
  error text,
  sent_at timestamptz,
  resend_id text
);

create table if not exists audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  candidate_id uuid references candidates(id) on delete set null,
  event text not null,
  detail text not null default ''
);

alter table candidates enable row level security;
alter table candidate_content enable row level security;
alter table hires enable row level security;
alter table rubric enable row level security;
alter table scores enable row level security;
alter table emails enable row level security;
alter table audit enable row level security;
