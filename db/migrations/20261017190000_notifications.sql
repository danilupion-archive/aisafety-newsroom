-- migrate:up

-- Each message aisafety-media had the bot send Dani through POST /api/v1/notify (D20): when it went out, and nothing
-- else, never its text. The route counts the last hour's rows to hold a runaway job to 30 messages an hour, across
-- both API replicas. Rows are never deleted (no DELETE grant anywhere, R-DB-2): a dozen a day.
CREATE TABLE app.notifications (
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_sent_at ON app.notifications (sent_at);

GRANT SELECT, INSERT ON app.notifications TO newsroom_app;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
