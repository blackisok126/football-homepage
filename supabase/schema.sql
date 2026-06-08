create table if not exists matches (
  id text primary key,
  match_date date not null,
  kickoff_time timestamptz,
  league text,
  home_team text,
  away_team text,
  status text,
  home_score int,
  away_score int,
  round text,
  source text,
  source_status text,
  raw jsonb,
  updated_at timestamptz default now()
);

create index if not exists idx_matches_match_date on matches(match_date);
create index if not exists idx_matches_kickoff_time on matches(kickoff_time);

create extension if not exists pgcrypto;

create table if not exists lottery_matches (
  id uuid primary key default gen_random_uuid(),
  match_key text unique not null,
  source text default 'china_lottery',
  issue_date text,
  match_no text,
  lottery_no text,
  league_cn text,
  home_team_cn text,
  away_team_cn text,
  kickoff_time timestamptz,
  sale_deadline timestamptz,
  status text,
  rq integer,
  score text,
  half_score text,
  spf_win numeric,
  spf_draw numeric,
  spf_lose numeric,
  rqspf_win numeric,
  rqspf_draw numeric,
  rqspf_lose numeric,
  raw jsonb,
  fetched_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_lottery_matches_match_key on lottery_matches(match_key);
create index if not exists idx_lottery_matches_kickoff_time on lottery_matches(kickoff_time);
create index if not exists idx_lottery_matches_match_no on lottery_matches(match_no);
