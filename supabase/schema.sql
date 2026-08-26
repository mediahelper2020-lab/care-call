-- AI 안심돌봄 · Supabase 스키마
-- Supabase 프로젝트의 SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
--
-- 애플리케이션의 DataStore 인터페이스(src/lib/store/types.ts)와 1:1로 대응합니다.
-- 개인정보 필드(name, phone, guardian_*, transcript)는 애플리케이션에서
-- AES-256-GCM으로 암호화한 문자열을 저장합니다. 데이터베이스에는 평문이 남지 않습니다.
--
-- 접근 제어: 모든 테이블에 RLS를 켜고 공개 정책을 두지 않습니다.
-- 서버(Next.js)만 service_role 키로 접근하며, 브라우저에 노출되는 anon 키로는
-- 어떤 행도 읽거나 쓸 수 없습니다.

-- 다시 실행할 수 있도록 기존 테이블을 정리합니다.
drop table if exists audit_logs cascade;
drop table if exists notifications cascade;
drop table if exists interventions cascade;
drop table if exists risk_signals cascade;
drop table if exists calls cascade;
drop table if exists clients cascade;
drop table if exists users cascade;
drop table if exists organizations cascade;

create table organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id text primary key,
  name text not null,
  role text not null default 'worker',          -- admin | worker
  organization_id text not null references organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table clients (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  name text not null,                            -- 암호화 저장
  masked_name text not null,                     -- 목록 화면 표기용 (김○○)
  birth_year int,
  phone text not null,                           -- 암호화 저장
  guardian_name text not null default '',        -- 암호화 저장
  guardian_phone text not null default '',       -- 암호화 저장
  assigned_worker text references users (id) on delete set null,
  call_schedule jsonb not null default '{"days":[1,3,5],"time":"09:00"}'::jsonb,
  consent_status text not null default 'pending', -- pending | granted | withdrawn
  recording_consent boolean not null default false,
  consent_updated_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  retention_until timestamptz not null
);

create index clients_worker_idx on clients (assigned_worker);
create index clients_retention_idx on clients (retention_until);

create table calls (
  id text primary key,
  client_id text not null references clients (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'scheduled',      -- scheduled | in_progress | completed | no_answer | failed
  transcript text not null default '',           -- 암호화된 JSON 문자열
  ai_summary text not null default '',
  risk_level text not null default 'normal',     -- normal | attention | urgent
  category_findings jsonb not null default '[]'::jsonb,
  decided_by text not null default 'none',       -- rule | ai | both | none
  ai_provider text not null default 'heuristic',
  acknowledged_by text references users (id) on delete set null,
  acknowledged_at timestamptz
);

create index calls_client_started_idx on calls (client_id, started_at desc);
create index calls_started_idx on calls (started_at desc);

create table risk_signals (
  id text primary key,
  call_id text not null references calls (id) on delete cascade,
  client_id text not null references clients (id) on delete cascade,
  category text not null,
  detected_text text not null,
  risk_level text not null,
  ai_reason text not null,
  source text not null default 'rule',           -- rule | ai
  created_at timestamptz not null default now()
);

create index risk_signals_client_idx on risk_signals (client_id, created_at desc);

create table interventions (
  id text primary key,
  client_id text not null references clients (id) on delete cascade,
  call_id text references calls (id) on delete set null,
  worker_id text not null references users (id) on delete cascade,
  action text not null,                          -- call_client | call_guardian | home_visit | medical_check | other
  note text not null default '',
  created_at timestamptz not null default now()
);

create index interventions_client_idx on interventions (client_id, created_at desc);

create table notifications (
  id text primary key,
  client_id text not null references clients (id) on delete cascade,
  call_id text not null references calls (id) on delete cascade,
  worker_id text not null references users (id) on delete cascade,
  risk_level text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_worker_idx on notifications (worker_id, created_at desc);

create table audit_logs (
  id text primary key,
  actor_id text,
  actor_name text not null,
  action text not null,
  target text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on audit_logs (created_at desc);

-- 브라우저에 노출되는 anon 키로는 어떤 행도 접근할 수 없게 합니다.
-- 서버에서 쓰는 service_role 키는 RLS를 우회하므로 앱은 정상 동작합니다.
alter table organizations enable row level security;
alter table users enable row level security;
alter table clients enable row level security;
alter table calls enable row level security;
alter table risk_signals enable row level security;
alter table interventions enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
