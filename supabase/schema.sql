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
  source text default 'juhe_worldcup',
  source_match_id text,
  match_time timestamptz,
  cn_league_name text,
  cn_home_name text,
  cn_away_name text,
  status text,
  round_name text,
  venue text,
  priority integer default 0,
  last_synced_at timestamptz default now(),
  raw_data jsonb,
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

alter table world_cup_matches add column if not exists source_match_id text;
alter table world_cup_matches add column if not exists match_time timestamptz;
alter table world_cup_matches add column if not exists cn_league_name text;
alter table world_cup_matches add column if not exists cn_home_name text;
alter table world_cup_matches add column if not exists cn_away_name text;
alter table world_cup_matches add column if not exists status text;
alter table world_cup_matches add column if not exists round_name text;
alter table world_cup_matches add column if not exists venue text;
alter table world_cup_matches add column if not exists priority integer default 0;
alter table world_cup_matches add column if not exists last_synced_at timestamptz default now();
alter table world_cup_matches add column if not exists raw_data jsonb;

create index if not exists idx_world_cup_matches_source_match_time
on world_cup_matches(source, match_time);
