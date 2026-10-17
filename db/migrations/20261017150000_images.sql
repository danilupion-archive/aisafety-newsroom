-- migrate:up

-- The images the site shows (D17): a post's lead image, under a clear licence, and its sources' preview images, the
-- outlets' own. Copies the site serves from its own host, never hotlinks: a reader's browser loads nothing from
-- another host (R-WEB-7). aisafety-media uploads each one before the post that names it (R-API-5), keyed by the SHA-256
-- of the bytes it sent, so a second upload of the same file changes nothing (R-API-3). What's stored is the API's own
-- re-encoding (R-WEB-15): raster only, metadata stripped, within a size, as WebP in two sizes, the full one for a post's
-- page and the thumbnail for a timeline card and a source's preview.
CREATE TABLE app.images (
  sha256 text PRIMARY KEY CONSTRAINT images_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  width integer NOT NULL CONSTRAINT images_width_positive CHECK (width > 0),
  height integer NOT NULL CONSTRAINT images_height_positive CHECK (height > 0),
  full_webp bytea NOT NULL CONSTRAINT images_full_size CHECK (octet_length(full_webp) BETWEEN 1 AND 2097152),
  thumb_webp bytea NOT NULL CONSTRAINT images_thumb_size CHECK (octet_length(thumb_webp) BETWEEN 1 AND 262144),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set by the bot's `/takedown image` (R-CAP-11): the site stops showing it everywhere, whatever post names it,
  -- until `/restore image` clears it. Never deleted (R-DB-2's rule, for images too).
  removed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON app.images TO newsroom_app;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
