-- migrate:up

-- The day a fetched page says it was published (R-API-4), sortable: `page_published_at` holds what the page states,
-- verbatim, as text. Best effort: an ISO date at its start (`2026-10-15`, `2026-10-15T08:00:00-07:00`) gives that day,
-- as the page writes it; anything else gives null, and sorts last.
--
-- Never raises: a page that states 30 February must not stop the worker storing its fetch. IMMUTABLE holds: an ISO
-- date reads the same under every DateStyle and time zone.
CREATE FUNCTION private.page_published_on(stated text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN substring(stated FROM '^\s*(\d{4}-\d{2}-\d{2})(?![\d])')::date;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
  RETURN NULL;
END
$$;

-- Generated, so it follows `page_published_at` whoever writes it, and items fetched before this get theirs as the
-- column is added: the table is rewritten, no row trigger fires, and `updated_at` (which times the clearing of page
-- texts) stays as it was. The worker writes the row, so newsroom_app runs the function.
GRANT EXECUTE ON FUNCTION private.page_published_on(text) TO newsroom_app;

ALTER TABLE app.inbox_items
  ADD COLUMN page_published_on date GENERATED ALWAYS AS (private.page_published_on(page_published_at)) STORED;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
