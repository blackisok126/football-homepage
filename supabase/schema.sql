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

create table if not exists world_cup_matches (
  id uuid primary key default gen_random_uuid(),
  match_key text unique not null,
  source text default 'api_football',
  fixture_id bigint,
  league_id bigint,
  league_name text,
  league_name_cn text,
  season integer,
  round text,
  group_name text,
  kickoff_time timestamptz,
  venue_name text,
  venue_city text,
  home_team_id bigint,
  away_team_id bigint,
  home_team_name text,
  away_team_name text,
  home_team_name_cn text,
  away_team_name_cn text,
  home_logo text,
  away_logo text,
  status_short text,
  status_long text,
  status_cn text,
  elapsed integer,
  home_score integer,
  away_score integer,
  halftime_score text,
  fulltime_score text,
  raw jsonb,
  fetched_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_world_cup_matches_kickoff_time
on world_cup_matches(kickoff_time);

create index if not exists idx_world_cup_matches_status
on world_cup_matches(status_short);

create table if not exists friendly_matches (
  id text primary key,
  match_date date not null,
  kickoff_time timestamptz,
  league text,
  league_zh text,
  home_team text,
  home_team_zh text,
  away_team text,
  away_team_zh text,
  status text,
  home_score int,
  away_score int,
  round text,
  source text,
  source_status text,
  raw jsonb,
  updated_at timestamptz default now()
);

create index if not exists idx_friendly_matches_match_date
on friendly_matches(match_date);

create index if not exists idx_friendly_matches_kickoff_time
on friendly_matches(kickoff_time);
