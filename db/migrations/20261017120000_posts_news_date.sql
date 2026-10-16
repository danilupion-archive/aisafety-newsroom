-- migrate:up

-- A post's news date (R-WEB-13): the day its story happened, as its original source dates it. A calendar day, not an
-- instant. A page never has one. Posted (published_at) stays the default order; the news date gives the site its
-- second, the story's own chronology.
--
-- Expand only, and nothing required here: posts pushed before this keep a null news date, and so does a push from a
-- client that doesn't send one yet, which the API dates by its posted day. Either way the views list a breve or an
-- article without one by the day it was posted, on the site's clock, so no row is ever refused or hidden for lacking it.
ALTER TABLE app.posts
  ADD COLUMN news_date date,
  ADD CONSTRAINT posts_page_has_no_news_date CHECK (type <> 'page' OR news_date IS NULL);

-- A story has one news date (R-WEB-13). Like D11's rule it lives in the view, not in a check between rows: a story is
-- pushed in two requests, so correcting its date leaves the versions apart between them, and a check would refuse
-- whichever went first. The site shows a story only while both versions have the same day, a missing one counting as
-- its posted day; pages have none. Same columns as before, the news date at the end (CREATE OR REPLACE keeps the
-- grants).
CREATE OR REPLACE VIEW app.published_posts WITH (security_barrier) AS
  SELECT post.slug, post.type, post.title, post.summary, post.body_md, post.sources, post.tags, post.published_at,
    post.updated_at, post.lang, post.translation_of_lang, post.translation_of_slug,
    CASE WHEN post.type <> 'page'
      THEN coalesce(post.news_date, (post.published_at AT TIME ZONE 'Europe/Madrid')::date)
    END AS news_date
  FROM app.posts post
  JOIN app.posts other
    ON (other.lang, other.slug) = (post.translation_of_lang, post.translation_of_slug)
    OR (other.translation_of_lang, other.translation_of_slug) = (post.lang, post.slug)
  WHERE post.unpublished_at IS NULL AND post.published_at <= now()
    AND other.unpublished_at IS NULL AND other.published_at <= now()
    AND (post.type = 'page'
      OR coalesce(post.news_date, (post.published_at AT TIME ZONE 'Europe/Madrid')::date)
        = coalesce(other.news_date, (other.published_at AT TIME ZONE 'Europe/Madrid')::date));

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
