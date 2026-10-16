-- migrate:up

-- The site is in Spanish and English (SPEC §13, D10): each post is written in one language, lives at /<lang>/<slug>,
-- and may translate a post in the other. A slug is unique within its language, so each version of a story has an
-- address in its own language. Posts pushed before this were all Spanish.
--
-- Not expand/contract: the key becomes (lang, slug) at once, so an API still on `PUT /posts/:slug` fails until its pods
-- are replaced. Nothing calls the posts API before this release (the site and aisafety-media's /post start with it).
CREATE TYPE app.post_lang AS ENUM ('es', 'en');

ALTER TABLE app.posts ADD COLUMN lang app.post_lang NOT NULL DEFAULT 'es';
ALTER TABLE app.posts ALTER COLUMN lang DROP DEFAULT;

ALTER TABLE app.posts DROP CONSTRAINT posts_pkey;
ALTER TABLE app.posts ADD CONSTRAINT posts_pkey PRIMARY KEY (lang, slug);

-- The post this one translates (R-WEB-10): in the other language, pushed already (published or not), at most one
-- translation per language, and never a translation itself (the trigger below), so a story is one original and its
-- translations.
ALTER TABLE app.posts
  ADD COLUMN translation_of_lang app.post_lang,
  ADD COLUMN translation_of_slug text,
  ADD CONSTRAINT posts_translation_pair
    CHECK ((translation_of_lang IS NULL) = (translation_of_slug IS NULL)),
  ADD CONSTRAINT posts_translation_other_lang CHECK (translation_of_lang <> lang),
  ADD CONSTRAINT posts_translation_of_fkey
    FOREIGN KEY (translation_of_lang, translation_of_slug) REFERENCES app.posts (lang, slug),
  ADD CONSTRAINT posts_one_translation_per_lang UNIQUE (translation_of_lang, translation_of_slug, lang);

-- Two pushes at once could each pass these checks on what it sees (one making X a translation, the other translating
-- X) and commit a chain. Every write that sets a translation takes the same lock first, so the second waits for the
-- first to commit, and its checks, each a fresh snapshot, see it.
CREATE FUNCTION private.posts_translation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.translation_of_lang IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('app.posts translations'));
  IF EXISTS (
    SELECT FROM app.posts
    WHERE lang = NEW.translation_of_lang AND slug = NEW.translation_of_slug AND translation_of_lang IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'post %/% is a translation itself', NEW.translation_of_lang, NEW.translation_of_slug
      USING ERRCODE = 'check_violation', CONSTRAINT = 'posts_translation_of_original';
  END IF;
  IF EXISTS (
    SELECT FROM app.posts WHERE translation_of_lang = NEW.lang AND translation_of_slug = NEW.slug
  ) THEN
    RAISE EXCEPTION 'post %/% has translations of its own', NEW.lang, NEW.slug
      USING ERRCODE = 'check_violation', CONSTRAINT = 'posts_translated_is_original';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER posts_translation
  BEFORE INSERT OR UPDATE OF translation_of_lang, translation_of_slug ON app.posts
  FOR EACH ROW EXECUTE FUNCTION private.posts_translation();

-- Lists are per language now.
DROP INDEX app.posts_published;
CREATE INDEX posts_published ON app.posts (lang, published_at DESC, slug)
  WHERE unpublished_at IS NULL AND type <> 'page';

-- The views gain the language and the translation, at their end (CREATE OR REPLACE keeps their grants).
CREATE OR REPLACE VIEW app.published_posts WITH (security_barrier) AS
  SELECT slug, type, title, summary, body_md, sources, tags, published_at, updated_at,
    lang, translation_of_lang, translation_of_slug
  FROM app.posts
  WHERE unpublished_at IS NULL AND published_at <= now();

CREATE OR REPLACE VIEW app.unpublished_posts WITH (security_barrier) AS
  SELECT slug, unpublished_at, lang
  FROM app.posts
  WHERE unpublished_at IS NOT NULL;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
