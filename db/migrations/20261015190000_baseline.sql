-- migrate:up

-- Migrations run as the database owner (newsroom_owner). The runtime roles newsroom_app and newsroom_public are
-- created by the cluster's Postgres provisioning (the cluster chart's extraRoles, which also grant them CONNECT) and
-- own nothing (SPEC §7). Migrations are forward-only: every down block is empty.

-- Only roles granted CONNECT explicitly may reach this database; other apps on the shared instance cannot.
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
END
$$;

-- Nothing is reachable through the public schema; it only holds dbmate's bookkeeping.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Closed by default: functions created by the owner are not executable by PUBLIC. Every grant is explicit.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- `app` holds the tables; `private` holds trigger functions, never tables.
CREATE SCHEMA app;
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- Runtime roles can look tables up in `app`. Table privileges are granted one by one.
GRANT USAGE ON SCHEMA app TO newsroom_app, newsroom_public;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
