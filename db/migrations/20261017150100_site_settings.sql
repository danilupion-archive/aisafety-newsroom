-- migrate:up

-- The site's switches, one row (R-CAP-10). `images`: which images the site shows, set by the bot's `/images` so
-- they can be turned down from a phone in seconds: `all`, `licensed` (a post's lead image, never the outlets'
-- previews) or `none`. Never the share cards (R-WEB-14), which are the site's own. The views read it on every request,
-- so nothing caches it on the way.
CREATE TABLE app.site_settings (
  id boolean PRIMARY KEY DEFAULT true CONSTRAINT site_settings_one_row CHECK (id),
  images text NOT NULL DEFAULT 'all'
    CONSTRAINT site_settings_images CHECK (images IN ('all', 'licensed', 'none')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.site_settings DEFAULT VALUES;

CREATE TRIGGER site_settings_touch_updated_at
  BEFORE UPDATE ON app.site_settings
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

GRANT SELECT, UPDATE ON app.site_settings TO newsroom_app;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
