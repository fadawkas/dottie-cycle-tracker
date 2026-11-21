CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  CHECK (end_date IS NULL OR end_date >= start_date),
  EXCLUDE USING gist (user_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
);

CREATE INDEX periods_user_start_idx ON periods (user_id, start_date DESC);

CREATE TABLE daily_logs (
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  day date NOT NULL,
  details jsonb NOT NULL CHECK (jsonb_typeof(details) = 'object'),
  PRIMARY KEY (user_id, day)
);

CREATE TABLE user_settings (
  user_id text PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  symptoms boolean NOT NULL,
  mood boolean NOT NULL,
  sleep boolean NOT NULL,
  sexual_activity boolean NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON periods, daily_logs, user_settings TO tracker_app;
