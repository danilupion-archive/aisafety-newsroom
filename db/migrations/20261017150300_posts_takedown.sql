-- migrate:up

-- A takedown (R-CAP-11): the bot hides a story at once, from a phone, when there's no time to go through
-- aisafety-media. Kept apart from `unpublished_at`, which only aisafety-media sets, so its `/post` sees the difference
-- and records the decision (R-MED-7); a push never clears it, so a rebuild can't bring a taken-down story back. Only
-- the bot's `/restore` does.
ALTER TABLE app.posts ADD COLUMN taken_down_at timestamptz;

-- Taken down, a story is gone like an unpublished one: neither version shows, and both answer 410 (D11). Same columns
-- as before (CREATE OR REPLACE keeps the grants).
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
  WHERE post.unpublished_at IS NULL AND post.published_at <= now() AND post.taken_down_at IS NULL
    AND other.unpublished_at IS NULL AND other.published_at <= now() AND other.taken_down_at IS NULL
    AND (post.type = 'page'
      OR coalesce(post.news_date, (post.published_at AT TIME ZONE 'Europe/Madrid')::date)
        = coalesce(other.news_date, (other.published_at AT TIME ZONE 'Europe/Madrid')::date));

CREATE OR REPLACE VIEW app.unpublished_posts WITH (security_barrier) AS
  SELECT post.slug,
    coalesce(post.unpublished_at, other.unpublished_at, post.taken_down_at, other.taken_down_at) AS unpublished_at,
    post.lang
  FROM app.posts post
  LEFT JOIN app.posts other
    ON (other.lang, other.slug) = (post.translation_of_lang, post.translation_of_slug)
    OR (other.translation_of_lang, other.translation_of_slug) = (post.lang, post.slug)
  WHERE post.unpublished_at IS NOT NULL OR other.unpublished_at IS NOT NULL
    OR post.taken_down_at IS NOT NULL OR other.taken_down_at IS NOT NULL;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
