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
