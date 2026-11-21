#!/bin/sh
# Generate disposable local credentials without installing Node on the host.
set -eu
docker run --rm node:24-alpine node -e '
const { randomBytes } = require("node:crypto");
for (const key of ["POSTGRES_PASSWORD", "TRACKER_DB_PASSWORD", "BETTER_AUTH_SECRET"]) {
  console.log(key + "=" + randomBytes(32).toString("hex"));
}'
