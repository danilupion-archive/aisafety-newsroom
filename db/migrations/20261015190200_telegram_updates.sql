-- migrate:up

-- Each Telegram update the bot has processed, so a redelivery is recognised and ignored (R-CAP-2).
CREATE TABLE app.telegram_updates (
  update_id bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON app.telegram_updates TO newsroom_app;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
