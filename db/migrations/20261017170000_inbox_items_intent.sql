-- migrate:up

-- What Dani wants from an item (D18): a post on the site as well as its log entry (`post`), or the log entry alone
-- (`log`). Every link is to be posted unless Dani says otherwise with the bot's `/log`; aisafety-media's `/news` drafts
-- posts only for `post` (R-MED-2) and reads a missing field as `post`, so either side can deploy first. Notes keep the
-- default: aisafety-media treats them by its own rules. Existing rows take the default without being updated, so their
-- `updated_at`, which the 90-day text clearing reads, stays as it is.
CREATE TYPE app.inbox_intent AS ENUM ('post', 'log');

ALTER TABLE app.inbox_items
  ADD COLUMN intent app.inbox_intent NOT NULL DEFAULT 'post';

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
