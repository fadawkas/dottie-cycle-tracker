#!/bin/sh
set -eu

psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set app_password="$TRACKER_DB_PASSWORD" <<'SQL'
CREATE ROLE tracker_app LOGIN PASSWORD :'app_password';
GRANT USAGE ON SCHEMA public TO tracker_app;
SQL
