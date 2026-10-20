-- migrate:up

-- Who and what stories are about (D23): the people, organisations and laws of aisafety-media's registry
-- (`entities/<id>.md`), a second dimension beside the tags and kept apart from them. aisafety-media is the record (P1):
-- every row can be pushed again (R-WEB-8). Nothing is ever deleted (R-DB-2): `DELETE /entities/:id` marks a row, and a
-- push brings it back.
CREATE TYPE app.entity_type AS ENUM ('person', 'organisation', 'law');

CREATE TABLE app.entities (
  -- A tag's shape, as aisafety-media names the file: `yoshua-bengio`, `openai`.
  id text PRIMARY KEY
    CONSTRAINT entities_id_format CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(id) <= 60),
  type app.entity_type NOT NULL,
  -- The name the site shows, and a language's own where it's another (R-WEB-20).
  name text NOT NULL CONSTRAINT entities_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  name_es text CONSTRAINT entities_name_es_length CHECK (char_length(name_es) BETWEEN 1 AND 200),
  name_en text CONSTRAINT entities_name_en_length CHECK (char_length(name_en) BETWEEN 1 AND 200),
  -- One public line in each language that says who or what it is.
  description_es text NOT NULL
    CONSTRAINT entities_description_es_length CHECK (char_length(description_es) BETWEEN 1 AND 160),
  description_en text NOT NULL
    CONSTRAINT entities_description_en_length CHECK (char_length(description_en) BETWEEN 1 AND 160),
  -- Its Wikidata item (`Q42`), or none: the site links it, and search engines read it (R-WEB-21).
  wikidata text CONSTRAINT entities_wikidata_format CHECK (wikidata ~ '^Q[1-9][0-9]{0,10}$'),
  -- {path, commit} in aisafety-media: where it came from. Never public.
  content_ref jsonb NOT NULL CONSTRAINT entities_content_ref_object CHECK (jsonb_typeof(content_ref) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Set by DELETE, once no post names it: posts can't name it any more. A push clears it.
  deleted_at timestamptz,
  -- Hidden by the bot (R-CAP-12): its page, and its name on posts, leave the site. Only the bot sets and clears it; a
  -- push never does, as for a post's takedown (R-CAP-11).
  taken_down_at timestamptz
);

CREATE TRIGGER entities_touch_updated_at
  BEFORE UPDATE ON app.entities
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- No DELETE: a deletion is a mark. The public reads go through views (the next migration), never the table.
GRANT SELECT, INSERT, UPDATE ON app.entities TO newsroom_app;

-- migrate:down
-- Forward-only: migrations are never rolled back. Recover by restoring a backup.
