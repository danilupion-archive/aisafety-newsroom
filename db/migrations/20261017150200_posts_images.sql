-- migrate:up

-- A post's lead image and its sources' previews (D17). `image` is {sha256, alt, credit, licence, source_url}: an
-- image under a clear licence, in app.images, with its alt text in the post's language (R-WEB-15). A source's preview
-- is `preview: {sha256, credit}` inside its entry in `sources` (R-WEB-16), so it needs no column. A page has no image.
ALTER TABLE app.posts
  ADD COLUMN image jsonb CONSTRAINT posts_image_object CHECK (image IS NULL OR jsonb_typeof(image) = 'object'),
  ADD CONSTRAINT posts_page_has_no_image CHECK (type <> 'page' OR image IS NULL);

-- What the public read routes see of each image, decided here on every read, so nothing on the way can show one past
-- its switch (R-CAP-10, R-CAP-11): a lead image, with its size, while the site shows `all` or `licensed` images and it
-- isn't removed; a source's preview while it shows `all` and it isn't removed, its entry without it otherwise. With no
-- settings row, no image: the switch fails closed. Same columns as before, the image at the end (CREATE OR REPLACE
-- keeps the grants).
CREATE OR REPLACE VIEW app.published_posts WITH (security_barrier) AS
  SELECT post.slug, post.type, post.title, post.summary, post.body_md,
    (SELECT coalesce(jsonb_agg(
        CASE
          WHEN NOT source.value ? 'preview' THEN source.value
          WHEN settings.images = 'all' AND EXISTS (
            SELECT FROM app.images image
            WHERE image.sha256 = source.value -> 'preview' ->> 'sha256' AND image.removed_at IS NULL)
          THEN source.value
          ELSE source.value - 'preview'
        END ORDER BY source.position), '[]')
     FROM jsonb_array_elements(post.sources) WITH ORDINALITY AS source (value, position)) AS sources,
    post.tags, post.published_at, post.updated_at, post.lang, post.translation_of_lang, post.translation_of_slug,
    CASE WHEN post.type <> 'page'
      THEN coalesce(post.news_date, (post.published_at AT TIME ZONE 'Europe/Madrid')::date)
    END AS news_date,
    CASE WHEN settings.images IN ('all', 'licensed')
      THEN (SELECT post.image || jsonb_build_object('width', image.width, 'height', image.height)
            FROM app.images image
            WHERE image.sha256 = post.image ->> 'sha256' AND image.removed_at IS NULL)
    END AS image
  FROM app.posts post
  LEFT JOIN app.site_settings settings ON true
  JOIN app.posts other
    ON (other.lang, other.slug) = (post.translation_of_lang, post.translation_of_slug)
    OR (other.translation_of_lang, other.translation_of_slug) = (post.lang, post.slug)
  WHERE post.unpublished_at IS NULL AND post.published_at <= now()
    AND other.unpublished_at IS NULL AND other.published_at <= now()
    AND (post.type = 'page'
      OR coalesce(post.news_date, (post.published_at AT TIME ZONE 'Europe/Madrid')::date)
        = coalesce(other.news_date, (other.published_at AT TIME ZONE 'Europe/Madrid')::date));

-- The image files the site may serve (R-WEB-15, R-WEB-16): those a published post shows, as a lead image or as a
-- preview, which the view above has already held to the switch and to removals. Anything else, an upload no
-- published post names included, isn't public.
CREATE VIEW app.public_images WITH (security_barrier) AS
  SELECT image.sha256, ref.kind, image.width, image.height, image.full_webp, image.thumb_webp
  FROM app.images image
  JOIN (
    SELECT published.image ->> 'sha256' AS sha256, 'lead' AS kind
    FROM app.published_posts published
    WHERE published.image IS NOT NULL
    UNION
    SELECT source.value -> 'preview' ->> 'sha256', 'preview'
    FROM app.published_posts published, jsonb_array_elements(published.sources) AS source (value)
    WHERE source.value ? 'preview'
  ) ref ON ref.sha256 = image.sha256
  WHERE image.removed_at IS NULL;

GRANT SELECT ON app.public_images TO newsroom_public;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
