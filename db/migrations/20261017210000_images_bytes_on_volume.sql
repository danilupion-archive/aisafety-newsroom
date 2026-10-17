-- migrate:up

-- Images' bytes live on the API's volume (D22, step 2a): app.images keeps what each image is (its size in pixels and in
-- bytes, when it was stored, whether the bot removed it), never the WebP itself. The byte columns stay, optional, until
-- step 2b drops them: API pods from before this release still write them during the rollout. Existing rows keep their
-- bytes until then, and take their sizes from them now.
ALTER TABLE app.images
  ALTER COLUMN full_webp DROP NOT NULL,
  ALTER COLUMN thumb_webp DROP NOT NULL,
  ADD COLUMN full_bytes integer CONSTRAINT images_full_bytes_positive CHECK (full_bytes > 0),
  ADD COLUMN thumb_bytes integer CONSTRAINT images_thumb_bytes_positive CHECK (thumb_bytes > 0);

UPDATE app.images
SET full_bytes = octet_length(full_webp), thumb_bytes = octet_length(thumb_webp)
WHERE full_webp IS NOT NULL;

-- The public view stops reading the bytes: same columns, so CREATE OR REPLACE keeps its grant, the two byte columns
-- always null now (older pods only read them when a file was missing). Step 2b drops them with the table's.
CREATE OR REPLACE VIEW app.public_images WITH (security_barrier) AS
  SELECT image.sha256, ref.kind, image.width, image.height,
    NULL::bytea AS full_webp, NULL::bytea AS thumb_webp
  FROM app.images image
  JOIN (
    SELECT published.image ->> 'sha256' AS sha256, 'lead' AS kind
    FROM app.published_posts published
    WHERE published.image IS NOT NULL
    UNION
    SELECT source.value -> 'preview' ->> 'sha256', 'preview'
    FROM app.published_posts published, LATERAL jsonb_array_elements(published.sources) AS source (value)
    WHERE source.value ? 'preview'
  ) ref ON ref.sha256 = image.sha256
  WHERE image.removed_at IS NULL;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
