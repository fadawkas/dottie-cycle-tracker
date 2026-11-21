ALTER TABLE user_settings
  ADD COLUMN typical_period_days smallint CHECK (typical_period_days BETWEEN 1 AND 30),
  ADD COLUMN symptom_shortcuts text[] NOT NULL DEFAULT ARRAY['cramps', 'headache', 'bloating']
    CHECK (cardinality(symptom_shortcuts) <= 6
       AND symptom_shortcuts <@ ARRAY['cramps', 'headache', 'bloating', 'fatigue', 'breastTenderness', 'acne']),
  ADD COLUMN notes boolean NOT NULL DEFAULT false,
  ADD COLUMN remind_daily boolean NOT NULL DEFAULT false,
  ADD COLUMN remind_period boolean NOT NULL DEFAULT false,
  ADD COLUMN remind_end boolean NOT NULL DEFAULT false;

CREATE TABLE signin_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX signin_limits_expires_idx ON signin_limits (expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON signin_limits TO tracker_app;
