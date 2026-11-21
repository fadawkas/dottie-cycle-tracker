ALTER TABLE periods ADD COLUMN end_unknown boolean NOT NULL DEFAULT false;
ALTER TABLE periods ADD CHECK (NOT end_unknown OR end_date IS NULL);
ALTER TABLE periods DROP CONSTRAINT periods_user_id_daterange_excl;
ALTER TABLE periods ADD CONSTRAINT periods_user_id_daterange_excl
  EXCLUDE USING gist (user_id WITH =,
    daterange(start_date, CASE WHEN end_unknown THEN start_date ELSE end_date END, '[]') WITH &&);

CREATE TABLE tracker_setup (
  user_id text PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE
);

INSERT INTO tracker_setup (user_id)
SELECT user_id FROM periods
UNION
SELECT user_id FROM daily_logs;

GRANT SELECT, INSERT, DELETE ON tracker_setup TO tracker_app;
