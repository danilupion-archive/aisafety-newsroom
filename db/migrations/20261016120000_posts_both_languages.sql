-- migrate:up

-- Every post is published in Spanish and English (D11): the site shows a story only when both versions are published,
-- and taking either down takes both down. The rule lives in the views, not in aisafety-media's tool: a story is pushed
-- in two requests, so between them, or for good if the second fails, a reader would see one language alone.
--
-- A post's other version is its original if it's a translation, its translation if it's an original. With two
-- languages, translations in the other one only, one per language and never translated themselves, a post has one at
-- most. Same columns as before (CREATE OR REPLACE keeps the grants).
CREATE OR REPLACE VIEW app.published_posts WITH (security_barrier) AS
  SELECT post.slug, post.type, post.title, post.summary, post.body_md, post.sources, post.tags, post.published_at,
    post.updated_at, post.lang, post.translation_of_lang, post.translation_of_slug
  FROM app.posts post
  JOIN app.posts other
    ON (other.lang, other.slug) = (post.translation_of_lang, post.translation_of_slug)
    OR (other.translation_of_lang, other.translation_of_slug) = (post.lang, post.slug)
  WHERE post.unpublished_at IS NULL AND post.published_at <= now()
    AND other.unpublished_at IS NULL AND other.published_at <= now();

-- Gone (410) once either version is unpublished, since when that version went. A post whose other version was never
-- pushed is in neither view: it was never public (404).
CREATE OR REPLACE VIEW app.unpublished_posts WITH (security_barrier) AS
  SELECT post.slug, coalesce(post.unpublished_at, other.unpublished_at) AS unpublished_at, post.lang
  FROM app.posts post
  LEFT JOIN app.posts other
    ON (other.lang, other.slug) = (post.translation_of_lang, post.translation_of_slug)
    OR (other.translation_of_lang, other.translation_of_slug) = (post.lang, post.slug)
  WHERE post.unpublished_at IS NOT NULL OR other.unpublished_at IS NOT NULL;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
