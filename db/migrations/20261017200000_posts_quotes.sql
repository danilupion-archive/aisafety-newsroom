-- migrate:up

-- A post's quotations (R-WEB-17, D21): up to three short, credited quotes from someone's post (on X, Bluesky, Mastodon,
-- LinkedIn…), each {text, author, handle?, url, date, translation?}, which the site draws as a card of its own: no
-- screenshot, no embed. The posts API validates each one; the table keeps the list's shape. A page has none. The
-- default fills existing rows without rewriting or touching them.
ALTER TABLE app.posts ADD COLUMN quotes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE app.posts ADD CONSTRAINT posts_quotes_list
  CHECK (jsonb_typeof(quotes) = 'array' AND jsonb_array_length(quotes) <= 3);
ALTER TABLE app.posts ADD CONSTRAINT posts_page_has_no_quotes
  CHECK (type <> 'page' OR quotes = '[]');

-- The published posts gain their quotations, at the end (CREATE OR REPLACE keeps the grants).
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
    CASE WHEN post.translation_of_lang IS NOT NULL THEN other.author END AS original_author,
    post.quotes
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
