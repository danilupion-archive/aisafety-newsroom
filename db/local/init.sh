#!/bin/sh
# Mirrors what the cluster `postgresql` chart provisions in the cluster: an owner role that owns the database, and
# runtime roles that own nothing. Local development only: the passwords come from compose.yaml and are not secrets.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_pw="$NEWSROOM_OWNER_PASSWORD" -v app_pw="$NEWSROOM_APP_PASSWORD" \
  -v public_pw="$NEWSROOM_PUBLIC_PASSWORD" <<'SQL'
CREATE ROLE newsroom_owner WITH LOGIN PASSWORD :'owner_pw';
-- The API and the worker.
CREATE ROLE newsroom_app WITH LOGIN PASSWORD :'app_pw'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- The API's public read routes: published posts only.
CREATE ROLE newsroom_public WITH LOGIN PASSWORD :'public_pw'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- `newsroom` for development, `newsroom_test` for the test suites (rebuilt from migrations on every run).
CREATE DATABASE newsroom OWNER newsroom_owner;
CREATE DATABASE newsroom_test OWNER newsroom_owner;
GRANT CONNECT ON DATABASE newsroom, newsroom_test TO newsroom_app, newsroom_public;
SQL
