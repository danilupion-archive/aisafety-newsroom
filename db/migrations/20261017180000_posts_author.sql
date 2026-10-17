-- migrate:up

-- Who wrote a post, when a person did (R-WEB-3, D19): their name as the site shows it. With none, the text is written
-- by AI and checked by the editor, as the site says everywhere. Each version carries its own: a translation with none,
-- of an original that has one, was translated with AI.
ALTER TABLE app.posts ADD COLUMN author text;
ALTER TABLE app.posts ADD CONSTRAINT posts_author_format
  CHECK (author IS NULL OR (char_length(author) BETWEEN 1 AND 100 AND author = btrim(author)));

-- The published posts gain their author and, for a translation, its original's, so the site can say a signed text's
-- translation was done with AI. New columns go at the end (CREATE OR REPLACE keeps the grants).
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
    END AS image,
    post.author,
    CASE WHEN post.translation_of_lang IS NOT NULL THEN other.author END AS original_author
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

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
