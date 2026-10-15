-- migrate:up

-- The inbox (SPEC §7): one row per captured link, or per note sent without one.
CREATE TYPE app.inbox_status AS ENUM ('queued', 'ready', 'needs_review', 'logged', 'discarded');
CREATE TYPE app.fetch_status AS ENUM ('pending', 'ok', 'failed', 'skipped');

CREATE TABLE app.inbox_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The Telegram user who sent it (R-CAP-9).
  submitted_by bigint,
  source text NOT NULL DEFAULT 'telegram' CONSTRAINT inbox_items_source_known CHECK (source IN ('telegram')),
  raw_text text NOT NULL DEFAULT '',
  -- As sent, and in the form that recognises it when it's sent again (R-CAP-5).
  url text,
  url_normalized text,
  -- Notes appended with timestamps.
  note text NOT NULL DEFAULT '',
  -- A note sent about an item already logged or discarded (R-CAP-6).
  follows_up bigint REFERENCES app.inbox_items (id),
  status app.inbox_status NOT NULL DEFAULT 'queued',
  fetch_status app.fetch_status NOT NULL DEFAULT 'pending',
  fetch_attempts integer NOT NULL DEFAULT 0 CONSTRAINT inbox_items_fetch_attempts_positive CHECK (fetch_attempts >= 0),
  next_fetch_at timestamptz,
  http_status integer,
  final_url text,
  content_type text,
  -- From the page's metadata, verbatim.
  page_title text,
  page_site_name text,
  page_published_at text,
  page_text text CONSTRAINT inbox_items_page_text_length CHECK (char_length(page_text) <= 20000),
  fetched_at timestamptz,
  logged_at timestamptz,
  -- {news_file, entry_date, tags, relevance}: a pointer into aisafety-media, which is the record.
  logged_ref jsonb CONSTRAINT inbox_items_logged_ref_object CHECK (jsonb_typeof(logged_ref) = 'object'),
  discard_reason text,
  last_error text,
  -- The "Saved #n" reply, so it can be edited once the page is fetched (R-CAP-7).
  reply_chat_id bigint,
  reply_message_id bigint,
  CONSTRAINT inbox_items_url_pair CHECK ((url IS NULL) = (url_normalized IS NULL)),
  -- A follow-up is a note: its link is the original's.
  CONSTRAINT inbox_items_follow_up_is_a_note CHECK (follows_up IS NULL OR url IS NULL),
  -- With nothing to fetch, a note goes straight to needs_review (R-CAP-4).
  CONSTRAINT inbox_items_note_needs_review CHECK (url IS NOT NULL OR status NOT IN ('queued', 'ready')),
  CONSTRAINT inbox_items_logged_has_ref CHECK (status <> 'logged' OR (logged_at IS NOT NULL AND logged_ref IS NOT NULL))
);

CREATE UNIQUE INDEX inbox_items_url_normalized_key ON app.inbox_items (url_normalized) WHERE url_normalized IS NOT NULL;
-- The worker's claim (R-FET-1): queued items that are due.
CREATE INDEX inbox_items_due ON app.inbox_items (next_fetch_at NULLS FIRST, id) WHERE status = 'queued';
-- `/news` and `/pending`: open items in order.
CREATE INDEX inbox_items_open ON app.inbox_items (status, id) WHERE status IN ('queued', 'ready', 'needs_review');
CREATE INDEX inbox_items_follows_up ON app.inbox_items (follows_up) WHERE follows_up IS NOT NULL;

-- The moves an item may make (R-DB-1): the same table as canTransition in packages/domain, whose database test
-- compares the two. Staying in a status is always allowed (a note, a fetch attempt, a logged item's new pointer).
CREATE FUNCTION private.inbox_items_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'queued' AND NEW.status IN ('ready', 'needs_review', 'discarded'))
    OR (OLD.status IN ('ready', 'needs_review') AND NEW.status IN ('logged', 'discarded'))
    OR (OLD.status = 'discarded' AND NEW.status IN ('queued', 'ready', 'needs_review'))
  ) THEN
    RAISE EXCEPTION 'item % can''t move from % to %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'inbox_items_transition';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER inbox_items_transition
  BEFORE UPDATE OF status ON app.inbox_items
  FOR EACH ROW EXECUTE FUNCTION private.inbox_items_transition();

CREATE FUNCTION private.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER inbox_items_touch_updated_at
  BEFORE UPDATE ON app.inbox_items
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- The API and the worker. No DELETE: items are never deleted in v1 (R-DB-2).
GRANT SELECT, INSERT, UPDATE ON app.inbox_items TO newsroom_app;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
