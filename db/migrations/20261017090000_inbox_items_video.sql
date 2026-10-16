-- migrate:up

-- What kind of thing a fetched link is, and for a video who published it and how long it is (R-FET-7). The worker
-- sets them when it stores a fetch; items fetched before this keep them null, as do items never fetched. Expand only:
-- the columns are nullable and nothing reads them yet, so the API and the worker of either release work with them.
ALTER TABLE app.inbox_items
  -- `page` for any web page or document, `video` for a YouTube video.
  ADD COLUMN page_kind text,
  -- Who published it, from its own metadata, verbatim: a video's channel.
  ADD COLUMN page_author text,
  -- A video's length. A live stream still on the air has none.
  ADD COLUMN page_duration_seconds integer,
  ADD CONSTRAINT inbox_items_page_kind_known CHECK (page_kind IN ('page', 'video')),
  ADD CONSTRAINT inbox_items_page_duration_positive CHECK (page_duration_seconds > 0),
  ADD CONSTRAINT inbox_items_page_duration_of_video
    CHECK (page_duration_seconds IS NULL OR page_kind = 'video');

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
