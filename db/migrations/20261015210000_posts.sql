-- migrate:up

-- What the public site shows (SPEC §13): breves and articles approved in aisafety-media and pushed through the posts
-- API, which is their only way in (R-WEB-2). aisafety-media is the record: every row can be pushed again (R-WEB-8).
CREATE TYPE app.post_type AS ENUM ('breve', 'article');

CREATE TABLE app.posts (
  slug text PRIMARY KEY
    CONSTRAINT posts_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 120),
  type app.post_type NOT NULL,
  title text NOT NULL CONSTRAINT posts_title_length CHECK (char_length(title) BETWEEN 1 AND 300),
  summary text NOT NULL DEFAULT '' CONSTRAINT posts_summary_length CHECK (char_length(summary) <= 600),
  -- Markdown, rendered to sanitised HTML by the site; never raw HTML (R-WEB-5).
  body_md text NOT NULL CONSTRAINT posts_body_length CHECK (char_length(body_md) BETWEEN 1 AND 200000),
  -- [{title, url, accessed}] (R-WEB-1).
  sources jsonb NOT NULL DEFAULT '[]' CONSTRAINT posts_sources_array CHECK (jsonb_typeof(sources) = 'array'),
  tags text[] NOT NULL DEFAULT '{}',
  published_at timestamptz NOT NULL,
  -- {path, commit} in aisafety-media: where the post came from. Never public.
  content_ref jsonb NOT NULL CONSTRAINT posts_content_ref_object CHECK (jsonb_typeof(content_ref) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Set by DELETE: the page answers 410 and leaves the feeds; pushing the post again clears it.
  unpublished_at timestamptz
);

CREATE INDEX posts_published ON app.posts (published_at DESC) WHERE unpublished_at IS NULL;
CREATE INDEX posts_tags ON app.posts USING gin (tags) WHERE unpublished_at IS NULL;

CREATE TRIGGER posts_touch_updated_at
  BEFORE UPDATE ON app.posts
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- The public read routes run as newsroom_public, which never sees the table: only published posts, without where they
-- came from, and the slugs of unpublished ones, so their pages can answer 410 (SPEC §7, §13).
CREATE VIEW app.published_posts WITH (security_barrier) AS
  SELECT slug, type, title, summary, body_md, sources, tags, published_at, updated_at
  FROM app.posts
  WHERE unpublished_at IS NULL AND published_at <= now();

CREATE VIEW app.unpublished_posts WITH (security_barrier) AS
  SELECT slug, unpublished_at
  FROM app.posts
  WHERE unpublished_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON app.posts TO newsroom_app;
GRANT SELECT ON app.published_posts, app.unpublished_posts TO newsroom_public;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
