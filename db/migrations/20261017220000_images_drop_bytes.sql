-- migrate:up

-- Images' bytes live only on the API's volume (D22, step 2b): step 2a's API reads and writes them there and never
-- touches these columns, so they go. First the sizes of rows that API pods from before step 2a wrote during its
-- rollout, with bytes but no sizes; then both sizes become required.
UPDATE app.images SET full_bytes = octet_length(full_webp) WHERE full_bytes IS NULL;
UPDATE app.images SET thumb_bytes = octet_length(thumb_webp) WHERE thumb_bytes IS NULL;

-- The public view selects the byte columns (as nulls since step 2a): it goes first, and comes back without them. Dropping
-- it drops its grant, given again below.
DROP VIEW app.public_images;

-- Dropping the columns drops their size checks (images_full_size, images_thumb_size) with them.
ALTER TABLE app.images
  DROP COLUMN full_webp,
  DROP COLUMN thumb_webp,
  ALTER COLUMN full_bytes SET NOT NULL,
  ALTER COLUMN thumb_bytes SET NOT NULL;

-- The files a published post shows, as that kind, while the switches allow them (R-CAP-10, R-CAP-11): what the site's
-- image route asks before it reads a file from the volume.
CREATE VIEW app.public_images WITH (security_barrier) AS
  SELECT image.sha256, ref.kind, image.width, image.height
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

GRANT SELECT ON app.public_images TO newsroom_public;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
