--
-- PostgreSQL database dump
--

\restrict schema

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: newsroom_owner
--

CREATE SCHEMA app;


ALTER SCHEMA app OWNER TO newsroom_owner;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: newsroom_owner
--

CREATE SCHEMA private;


ALTER SCHEMA private OWNER TO newsroom_owner;

--
-- Name: fetch_status; Type: TYPE; Schema: app; Owner: newsroom_owner
--

CREATE TYPE app.fetch_status AS ENUM (
    'pending',
    'ok',
    'failed',
    'skipped'
);


ALTER TYPE app.fetch_status OWNER TO newsroom_owner;

--
-- Name: inbox_status; Type: TYPE; Schema: app; Owner: newsroom_owner
--

CREATE TYPE app.inbox_status AS ENUM (
    'queued',
    'ready',
    'needs_review',
    'logged',
    'discarded'
);


ALTER TYPE app.inbox_status OWNER TO newsroom_owner;

--
-- Name: post_lang; Type: TYPE; Schema: app; Owner: newsroom_owner
--

CREATE TYPE app.post_lang AS ENUM (
    'es',
    'en'
);


ALTER TYPE app.post_lang OWNER TO newsroom_owner;

--
-- Name: post_type; Type: TYPE; Schema: app; Owner: newsroom_owner
--

CREATE TYPE app.post_type AS ENUM (
    'breve',
    'article',
    'page'
);


ALTER TYPE app.post_type OWNER TO newsroom_owner;

--
-- Name: inbox_items_transition(); Type: FUNCTION; Schema: private; Owner: newsroom_owner
--

CREATE FUNCTION private.inbox_items_transition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'queued' AND NEW.status IN ('ready', 'needs_review', 'discarded'))
    OR (OLD.status IN ('ready', 'needs_review') AND NEW.status IN ('logged', 'discarded'))
    OR (OLD.status = 'discarded' AND NEW.status IN ('queued', 'ready', 'needs_review'))
  ) THEN
    RAISE EXCEPTION 'item % can''t move from % to %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'inbox_items_transition';
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION private.inbox_items_transition() OWNER TO newsroom_owner;

--
-- Name: posts_translation(); Type: FUNCTION; Schema: private; Owner: newsroom_owner
--

CREATE FUNCTION private.posts_translation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


ALTER FUNCTION private.posts_translation() OWNER TO newsroom_owner;

--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: private; Owner: newsroom_owner
--

CREATE FUNCTION private.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;


ALTER FUNCTION private.touch_updated_at() OWNER TO newsroom_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: inbox_items; Type: TABLE; Schema: app; Owner: newsroom_owner
--

CREATE TABLE app.inbox_items (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_by bigint,
    source text DEFAULT 'telegram'::text NOT NULL,
    raw_text text DEFAULT ''::text NOT NULL,
    url text,
    url_normalized text,
    note text DEFAULT ''::text NOT NULL,
    follows_up bigint,
    status app.inbox_status DEFAULT 'queued'::app.inbox_status NOT NULL,
    fetch_status app.fetch_status DEFAULT 'pending'::app.fetch_status NOT NULL,
    fetch_attempts integer DEFAULT 0 NOT NULL,
    next_fetch_at timestamp with time zone,
    http_status integer,
    final_url text,
    content_type text,
    page_title text,
    page_site_name text,
    page_published_at text,
    page_text text,
    fetched_at timestamp with time zone,
    logged_at timestamp with time zone,
    logged_ref jsonb,
    discard_reason text,
    last_error text,
    reply_chat_id bigint,
    reply_message_id bigint,
    CONSTRAINT inbox_items_fetch_attempts_positive CHECK ((fetch_attempts >= 0)),
    CONSTRAINT inbox_items_follow_up_is_a_note CHECK (((follows_up IS NULL) OR (url IS NULL))),
    CONSTRAINT inbox_items_logged_has_ref CHECK (((status <> 'logged'::app.inbox_status) OR ((logged_at IS NOT NULL) AND (logged_ref IS NOT NULL)))),
    CONSTRAINT inbox_items_logged_ref_object CHECK ((jsonb_typeof(logged_ref) = 'object'::text)),
    CONSTRAINT inbox_items_note_needs_review CHECK (((url IS NOT NULL) OR (status <> ALL (ARRAY['queued'::app.inbox_status, 'ready'::app.inbox_status])))),
    CONSTRAINT inbox_items_page_text_length CHECK ((char_length(page_text) <= 20000)),
    CONSTRAINT inbox_items_source_known CHECK ((source = 'telegram'::text)),
    CONSTRAINT inbox_items_url_pair CHECK (((url IS NULL) = (url_normalized IS NULL)))
);


ALTER TABLE app.inbox_items OWNER TO newsroom_owner;

--
-- Name: inbox_items_id_seq; Type: SEQUENCE; Schema: app; Owner: newsroom_owner
--

ALTER TABLE app.inbox_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME app.inbox_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: posts; Type: TABLE; Schema: app; Owner: newsroom_owner
--

CREATE TABLE app.posts (
    slug text NOT NULL,
    type app.post_type NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    body_md text NOT NULL,
    sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    published_at timestamp with time zone NOT NULL,
    content_ref jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    unpublished_at timestamp with time zone,
    lang app.post_lang NOT NULL,
    translation_of_lang app.post_lang,
    translation_of_slug text,
    CONSTRAINT posts_body_length CHECK (((char_length(body_md) >= 1) AND (char_length(body_md) <= 200000))),
    CONSTRAINT posts_content_ref_object CHECK ((jsonb_typeof(content_ref) = 'object'::text)),
    CONSTRAINT posts_slug_format CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 120))),
    CONSTRAINT posts_sources_array CHECK ((jsonb_typeof(sources) = 'array'::text)),
    CONSTRAINT posts_summary_length CHECK ((char_length(summary) <= 600)),
    CONSTRAINT posts_title_length CHECK (((char_length(title) >= 1) AND (char_length(title) <= 300))),
    CONSTRAINT posts_translation_other_lang CHECK ((translation_of_lang <> lang)),
    CONSTRAINT posts_translation_pair CHECK (((translation_of_lang IS NULL) = (translation_of_slug IS NULL)))
);


ALTER TABLE app.posts OWNER TO newsroom_owner;

--
-- Name: published_posts; Type: VIEW; Schema: app; Owner: newsroom_owner
--

CREATE VIEW app.published_posts WITH (security_barrier='true') AS
 SELECT post.slug,
    post.type,
    post.title,
    post.summary,
    post.body_md,
    post.sources,
    post.tags,
    post.published_at,
    post.updated_at,
    post.lang,
    post.translation_of_lang,
    post.translation_of_slug
   FROM (app.posts post
     JOIN app.posts other ON ((((other.lang = post.translation_of_lang) AND (other.slug = post.translation_of_slug)) OR ((other.translation_of_lang = post.lang) AND (other.translation_of_slug = post.slug)))))
  WHERE ((post.unpublished_at IS NULL) AND (post.published_at <= now()) AND (other.unpublished_at IS NULL) AND (other.published_at <= now()));


ALTER VIEW app.published_posts OWNER TO newsroom_owner;

--
-- Name: telegram_updates; Type: TABLE; Schema: app; Owner: newsroom_owner
--

CREATE TABLE app.telegram_updates (
    update_id bigint NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE app.telegram_updates OWNER TO newsroom_owner;

--
-- Name: unpublished_posts; Type: VIEW; Schema: app; Owner: newsroom_owner
--

CREATE VIEW app.unpublished_posts WITH (security_barrier='true') AS
 SELECT post.slug,
    COALESCE(post.unpublished_at, other.unpublished_at) AS unpublished_at,
    post.lang
   FROM (app.posts post
     LEFT JOIN app.posts other ON ((((other.lang = post.translation_of_lang) AND (other.slug = post.translation_of_slug)) OR ((other.translation_of_lang = post.lang) AND (other.translation_of_slug = post.slug)))))
  WHERE ((post.unpublished_at IS NOT NULL) OR (other.unpublished_at IS NOT NULL));


ALTER VIEW app.unpublished_posts OWNER TO newsroom_owner;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: newsroom_owner
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO newsroom_owner;

--
-- Name: inbox_items inbox_items_pkey; Type: CONSTRAINT; Schema: app; Owner: newsroom_owner
--

ALTER TABLE ONLY app.inbox_items
    ADD CONSTRAINT inbox_items_pkey PRIMARY KEY (id);


--
-- Name: posts posts_one_translation_per_lang; Type: CONSTRAINT; Schema: app; Owner: newsroom_owner
--

ALTER TABLE ONLY app.posts
    ADD CONSTRAINT posts_one_translation_per_lang UNIQUE (translation_of_lang, translation_of_slug, lang);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: app; Owner: newsroom_owner
--

ALTER TABLE ONLY app.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (lang, slug);


--
-- Name: telegram_updates telegram_updates_pkey; Type: CONSTRAINT; Schema: app; Owner: newsroom_owner
--

ALTER TABLE ONLY app.telegram_updates
    ADD CONSTRAINT telegram_updates_pkey PRIMARY KEY (update_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: newsroom_owner
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: inbox_items_due; Type: INDEX; Schema: app; Owner: newsroom_owner
--

CREATE INDEX inbox_items_due ON app.inbox_items USING btree (next_fetch_at NULLS FIRST, id) WHERE (status = 'queued'::app.inbox_status);


--
-- Name: inbox_items_follows_up; Type: INDEX; Schema: app; Owner: newsroom_owner
--

CREATE INDEX inbox_items_follows_up ON app.inbox_items USING btree (follows_up) WHERE (follows_up IS NOT NULL);


--
-- Name: inbox_items_open; Type: INDEX; Schema: app; Owner: newsroom_owner
--

CREATE INDEX inbox_items_open ON app.inbox_items USING btree (status, id) WHERE (status = ANY (ARRAY['queued'::app.inbox_status, 'ready'::app.inbox_status, 'needs_review'::app.inbox_status]));


--
-- Name: inbox_items_url_normalized_key; Type: INDEX; Schema: app; Owner: newsroom_owner
--

CREATE UNIQUE INDEX inbox_items_url_normalized_key ON app.inbox_items USING btree (url_normalized) WHERE (url_normalized IS NOT NULL);


--
-- Name: posts_published; Type: INDEX; Schema: app; Owner: newsroom_owner
--

CREATE INDEX posts_published ON app.posts USING btree (lang, published_at DESC, slug) WHERE ((unpublished_at IS NULL) AND (type <> 'page'::app.post_type));


--
-- Name: posts_tags; Type: INDEX; Schema: app; Owner: newsroom_owner
--

CREATE INDEX posts_tags ON app.posts USING gin (tags) WHERE (unpublished_at IS NULL);


--
-- Name: inbox_items inbox_items_touch_updated_at; Type: TRIGGER; Schema: app; Owner: newsroom_owner
--

CREATE TRIGGER inbox_items_touch_updated_at BEFORE UPDATE ON app.inbox_items FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();


--
-- Name: inbox_items inbox_items_transition; Type: TRIGGER; Schema: app; Owner: newsroom_owner
--

CREATE TRIGGER inbox_items_transition BEFORE UPDATE OF status ON app.inbox_items FOR EACH ROW EXECUTE FUNCTION private.inbox_items_transition();


--
-- Name: posts posts_touch_updated_at; Type: TRIGGER; Schema: app; Owner: newsroom_owner
--

CREATE TRIGGER posts_touch_updated_at BEFORE UPDATE ON app.posts FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();


--
-- Name: posts posts_translation; Type: TRIGGER; Schema: app; Owner: newsroom_owner
--

CREATE TRIGGER posts_translation BEFORE INSERT OR UPDATE OF translation_of_lang, translation_of_slug ON app.posts FOR EACH ROW EXECUTE FUNCTION private.posts_translation();


--
-- Name: inbox_items inbox_items_follows_up_fkey; Type: FK CONSTRAINT; Schema: app; Owner: newsroom_owner
--

ALTER TABLE ONLY app.inbox_items
    ADD CONSTRAINT inbox_items_follows_up_fkey FOREIGN KEY (follows_up) REFERENCES app.inbox_items(id);


--
-- Name: posts posts_translation_of_fkey; Type: FK CONSTRAINT; Schema: app; Owner: newsroom_owner
--

ALTER TABLE ONLY app.posts
    ADD CONSTRAINT posts_translation_of_fkey FOREIGN KEY (translation_of_lang, translation_of_slug) REFERENCES app.posts(lang, slug);


--
-- Name: SCHEMA app; Type: ACL; Schema: -; Owner: newsroom_owner
--

GRANT USAGE ON SCHEMA app TO newsroom_app;
GRANT USAGE ON SCHEMA app TO newsroom_public;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- Name: FUNCTION inbox_items_transition(); Type: ACL; Schema: private; Owner: newsroom_owner
--

REVOKE ALL ON FUNCTION private.inbox_items_transition() FROM PUBLIC;


--
-- Name: FUNCTION posts_translation(); Type: ACL; Schema: private; Owner: newsroom_owner
--

REVOKE ALL ON FUNCTION private.posts_translation() FROM PUBLIC;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: private; Owner: newsroom_owner
--

REVOKE ALL ON FUNCTION private.touch_updated_at() FROM PUBLIC;


--
-- Name: TABLE inbox_items; Type: ACL; Schema: app; Owner: newsroom_owner
--

GRANT SELECT,INSERT,UPDATE ON TABLE app.inbox_items TO newsroom_app;


--
-- Name: TABLE posts; Type: ACL; Schema: app; Owner: newsroom_owner
--

GRANT SELECT,INSERT,UPDATE ON TABLE app.posts TO newsroom_app;


--
-- Name: TABLE published_posts; Type: ACL; Schema: app; Owner: newsroom_owner
--

GRANT SELECT ON TABLE app.published_posts TO newsroom_public;


--
-- Name: TABLE telegram_updates; Type: ACL; Schema: app; Owner: newsroom_owner
--

GRANT SELECT,INSERT ON TABLE app.telegram_updates TO newsroom_app;


--
-- Name: TABLE unpublished_posts; Type: ACL; Schema: app; Owner: newsroom_owner
--

GRANT SELECT ON TABLE app.unpublished_posts TO newsroom_public;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: newsroom_owner
--

ALTER DEFAULT PRIVILEGES FOR ROLE newsroom_owner REVOKE ALL ON FUNCTIONS FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict schema

