-- AI 안심돌봄 · Supabase 스키마 (2단계 전환용)
-- 애플리케이션의 DataStore 인터페이스(src/lib/store/types.ts)와 1:1로 대응합니다.
-- 개인정보 필드(name, phone, guardian_*, transcript)는 애플리케이션에서
-- AES-256-GCM으로 암호화한 문자열을 저장합니다.

create type user_role as enum ('admin', 'worker');
create type risk_level as enum ('normal', 'attention', 'urgent');
create type call_status as enum ('scheduled', 'in_progress', 'completed', 'no_answer', 'failed');
create type consent_status as enum ('pending', 'granted', 'withdrawn');
create type signal_source as enum ('rule', 'ai');
create type intervention_action as enum (
  'call_client', 'call_guardian', 'home_visit', 'medical_check', 'other'
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role user_role not null default 'worker',
  organization_id uuid not null references organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,               -- 암호화 저장
  masked_name text not null,        -- 목록 화면 표기용
  birth_year int,
  phone text not null,              -- 암호화 저장
  guardian_name text default '',    -- 암호화 저장
  guardian_phone text default '',   -- 암호화 저장
  assigned_worker uuid references users (id) on delete set null,
  call_schedule jsonb not null default '{"days":[1,3,5],"time":"09:00"}'::jsonb,
  consent_status consent_status not null default 'pending',
  recording_consent boolean not null default false,
  consent_updated_at timestamptz,
  note text default '',
  created_at timestamptz not null default now(),
  retention_until timestamptz not null
);

create index clients_worker_idx on clients (assigned_worker);
create index clients_retention_idx on clients (retention_until);

create table calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status call_status not null default 'scheduled',
  transcript text default '',       -- 암호화된 JSON 문자열
  ai_summary text default '',
  risk_level risk_level not null default 'normal',
  category_findings jsonb not null default '[]'::jsonb,
  decided_by text not null default 'none',
  ai_provider text not null default 'heuristic',
  acknowledged_by uuid references users (id) on delete set null,
  acknowledged_at timestamptz
);

create index calls_client_started_idx on calls (client_id, started_at desc);

create table risk_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  category text not null,
  detected_text text not null,
  risk_level risk_level not null,
  ai_reason text not null,
  source signal_source not null default 'rule',
  created_at timestamptz not null default now()
);

create index risk_signals_client_idx on risk_signals (client_id, created_at desc);

create table interventions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  call_id uuid references calls (id) on delete set null,
  worker_id uuid not null references users (id) on delete cascade,
  action intervention_action not null,
  note text default '',
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  call_id uuid not null references calls (id) on delete cascade,
  worker_id uuid not null references users (id) on delete cascade,
  risk_level risk_level not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users (id) on delete set null,
  actor_name text not null,
  action text not null,
  target text not null,
  detail text default '',
  created_at timestamptz not null default now()
);

-- 접근권한: 관리자는 소속 기관 전체, 사회복지사는 담당 대상자만 열람합니다.
alter table clients enable row level security;
alter table calls enable row level security;
alter table risk_signals enable row level security;
alter table interventions enable row level security;
alter table notifications enable row level security;

create or replace function current_app_user()
returns users
language sql
stable
as $$
  select * from users where id = auth.uid();
$$;

create policy clients_read on clients
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.organization_id = clients.organization_id
        and (u.role = 'admin' or clients.assigned_worker = u.id)
    )
  );

create policy calls_read on calls
  for select using (
    exists (
      select 1 from clients c join users u on u.organization_id = c.organization_id
      where c.id = calls.client_id
        and u.id = auth.uid()
        and (u.role = 'admin' or c.assigned_worker = u.id)
    )
  );

create policy risk_signals_read on risk_signals
  for select using (
    exists (
      select 1 from clients c join users u on u.organization_id = c.organization_id
      where c.id = risk_signals.client_id
        and u.id = auth.uid()
        and (u.role = 'admin' or c.assigned_worker = u.id)
    )
  );

create policy interventions_read on interventions
  for select using (
    exists (
      select 1 from clients c join users u on u.organization_id = c.organization_id
      where c.id = interventions.client_id
        and u.id = auth.uid()
        and (u.role = 'admin' or c.assigned_worker = u.id)
    )
  );

create policy notifications_read on notifications
  for select using (worker_id = auth.uid());
