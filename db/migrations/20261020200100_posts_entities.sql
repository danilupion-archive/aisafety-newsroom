-- migrate:up

-- Who and what each post is about (D23, R-WEB-20): ids of app.entities, in the order aisafety-media lists them, at most
-- ten (the posts API's cap; aisafety-media lists up to six). Each version of a story carries its own list, like its
-- tags, and aisafety-media gives both the same. A page has none. The default fills existing rows without rewriting
-- them.
ALTER TABLE app.posts ADD COLUMN entities text[] NOT NULL DEFAULT '{}';
ALTER TABLE app.posts ADD CONSTRAINT posts_entities_list
  CHECK (cardinality(entities) <= 10 AND array_position(entities, NULL) IS NULL);
ALTER TABLE app.posts ADD CONSTRAINT posts_page_has_no_entities
  CHECK (type <> 'page' OR entities = '{}');

-- Every post naming an entity, unpublished ones included: what an entity's deletion checks.
CREATE INDEX posts_entities ON app.posts USING gin (entities);

-- An array holds no foreign key, so these two triggers do its work (R-API-6), both under its name. A post names only
-- entities in the registry, and not deleted: its push locks them (FOR SHARE, which a deletion's UPDATE waits for), then
-- looks again, so a deletion committed meanwhile is seen. An entity a post names can't be deleted: the deletion waits
-- for any push holding it, then finds the post. Either way, whichever comes second sees the other.
CREATE FUNCTION private.posts_entities_known() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  unknown text;
BEGIN
  IF cardinality(NEW.entities) = 0 THEN
    RETURN NEW;
  END IF;
  PERFORM FROM app.entities WHERE id = ANY (NEW.entities) AND deleted_at IS NULL FOR SHARE;
  SELECT string_agg(listed.id, ', ' ORDER BY listed.position) INTO unknown
  FROM unnest(NEW.entities) WITH ORDINALITY AS listed (id, position)
  WHERE NOT EXISTS (SELECT FROM app.entities entity WHERE entity.id = listed.id AND entity.deleted_at IS NULL);
  IF unknown IS NOT NULL THEN
    RAISE EXCEPTION 'post %/% names entities the registry doesn''t have: %', NEW.lang, NEW.slug, unknown
      USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'posts_entities_known';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER posts_entities_known
  BEFORE INSERT OR UPDATE OF entities ON app.posts
  FOR EACH ROW EXECUTE FUNCTION private.posts_entities_known();

CREATE FUNCTION private.entities_named() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  naming text;
BEGIN
  IF NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT string_agg(post.lang || '/' || post.slug, ', ' ORDER BY post.lang, post.slug) INTO naming
  FROM app.posts post
  WHERE post.entities @> ARRAY[NEW.id];
  IF naming IS NOT NULL THEN
    RAISE EXCEPTION 'entity % is named by %', NEW.id, naming
      USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'posts_entities_known';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER entities_named
  BEFORE UPDATE OF deleted_at ON app.entities
  FOR EACH ROW EXECUTE FUNCTION private.entities_named();

-- The published posts gain their entities, at the end (CREATE OR REPLACE keeps the grants): each as {id, type, name,
-- wikidata}, its name in the post's language, in the post's order, without those the bot hid (R-CAP-12).
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
    post.quotes,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', entity.id,
        'type', entity.type,
        'name', CASE post.lang WHEN 'es' THEN coalesce(entity.name_es, entity.name)
          ELSE coalesce(entity.name_en, entity.name) END,
        'wikidata', entity.wikidata) ORDER BY listed.position), '[]')
     FROM unnest(post.entities) WITH ORDINALITY AS listed (id, position)
     JOIN app.entities entity ON entity.id = listed.id
     WHERE entity.taken_down_at IS NULL AND entity.deleted_at IS NULL) AS entities
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

-- Every entity a published story names, once for each language it's named in (R-WEB-20): its name and description in
-- that language, its Wikidata item, and how many of the language's stories name it. One no published story names, or
-- one the bot hid, isn't here: its page answers 404.
CREATE VIEW app.public_entities WITH (security_barrier) AS
  SELECT post.lang, entity.id, entity.type,
    CASE post.lang WHEN 'es' THEN coalesce(entity.name_es, entity.name)
      ELSE coalesce(entity.name_en, entity.name) END AS name,
    CASE post.lang WHEN 'es' THEN entity.description_es ELSE entity.description_en END AS description,
    entity.wikidata,
    count(*)::integer AS posts
  FROM app.published_posts post
  CROSS JOIN LATERAL jsonb_array_elements(post.entities) AS listed (value)
  JOIN app.entities entity ON entity.id = listed.value ->> 'id'
  WHERE post.type <> 'page'
  GROUP BY post.lang, entity.id;

GRANT SELECT ON app.public_entities TO newsroom_public;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
