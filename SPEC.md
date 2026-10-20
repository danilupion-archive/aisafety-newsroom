# aisafety-newsroom · Specification

Status: **draft v0.21** · 2026-10-20 · Owner: Dani

v0.21 changes: entities, the people, organisations and laws a story is about, beside its
topics: a registry copied from aisafety-media through the posts API, a list on each post,
and a page for each with its timeline under `/quien` and `/en/who`, with an index (D23,
R-API-6, R-WEB-20); structured data for posts and entities (R-WEB-21); the bot can hide an
entity (R-CAP-12). `quien` and `who` are reserved.

v0.20 changes: the header's mark is bigger, its tentacles bend along their length, its
light breathes, and the box opens on every full page load (R-WEB-11).

v0.19 changes: the header's mark is animated (R-WEB-11): the box opens and the tentacles
come out on a visit's first page, sway lightly ever after and more on hover; still with
reduced motion.

v0.18 changes: the image move is done (D22, step 2b): the database holds no image bytes,
only their metadata and switches.

v0.17 changes: images' bytes live only on the volume (D22, step 2a): uploads write files and
a row with their sizes, the site serves files only, and the database's byte columns wait
to be dropped (step 2b).

v0.16 changes: images' bytes move to a volume, in two steps; this is the first: the API
writes files as well as the database, serves from files and copies the existing ones
(D22); `GET /images` counts them.

v0.15 changes: search (`/buscar`, `/en/search`; R-WEB-18); the timeline keeps loading as the
reader scrolls, pausing for a button every 100 posts (R-WEB-19); `buscar` and `search` are
reserved; a footer in two parts.

v0.14 changes: quote cards: a post may quote up to three public posts (X, Bluesky…), drawn
by the site with author, date and a link, never a screenshot or an embed (R-WEB-17, D21).

v0.13 changes: the site's look (R-WEB-11): the box mark with tentacles rising out of it in
a pink glow, aquamarine for links and controls, pink for highlights, a gradient "IA"; no
PauseAI colours left.

v0.12 changes: aisafety-media can message Dani through the bot (`POST /notify`, at most 30
an hour; D20, R-MED-8); its image side (R-MED-7) is built.

v0.11 changes: every AI-written post says so on its card and its page, and the site no
longer claims every text was checked; a post a person writes carries their name, and an
AI translation of it says so (R-WEB-3, D19). New topic: self-improvement. The bot's
edited reply keeps "· log only".

v0.10 changes: every inbox item has an intent, `post` (the default: /news drafts a post
for it) or `log` (the news log only), set with `/log` and `/post` in the bot (D18, R-CAP-8,
R-MED-2); the API returns it.

v0.9 changes: YouTube videos play on the card and the post, loaded only when the reader
presses play (R-WEB-12). A card without a lead image shows its first source's preview.

v0.8 changes: images (D17, Q13 closed): a share card the site makes for every page
(R-WEB-14), a post's lead image with a clear licence (R-WEB-15) and its sources' preview
images (R-WEB-16), all copies the site serves, uploaded through the API (R-API-5). The bot
turns images off or on and takes a post or one image down at once (R-CAP-10, R-CAP-11).
aisafety-media's side is specified, not built (R-MED-7). The footer's about link reads
"Sobre PandorIA".

v0.7 changes: three dates kept apart (D16): when Dani found a link, the page's own day,
and for a post its posted day and its news date. The timeline stays in posted order and
has a second view by news date (R-WEB-13); the inbox sorts by the page's day too
(R-API-4). A missing page's message is in its HTML, not only in a script.

v0.6 changes: the site says on every page and in its feeds that its texts are written
by AI, picked and checked by Dani (R-WEB-3); its tagline is "La caja ya está abierta".
YouTube links are captured as videos, with channel, length and description (R-CAP-5,
R-FET-7); transcripts are fetched on the Mac (R-MED-6); how a video source shows on the
site is specified, not built (R-WEB-12). Miniflux waits: sources are checked by hand
(D13). The texts are CC BY 4.0 (D14; Q10 closed). A breve's length applies to the
language it's written in, not to its translation (D15; Q12 closed).

v0.5 changes: Spanish is at the site's root and English under `/en/`; `/es/…` redirects to
the same address without the prefix (D10, AC-11).

v0.4 changes: the site is PandorIA, at `pandoria.es`, with a look of its own (D12,
R-WEB-11); the API and the bot stay on `newsroom.danilupion.com` (D8). Images on posts
are an open question (Q13).

v0.3 changes: the site is in Spanish and English from v1 (D10); every post is published
in both languages, and the site shows a story only when both versions are (D11,
R-WEB-10).

v0.2 changes: everything runs on Dani's Kubernetes cluster and n8n is no longer part of the system;
the stack follows aiontheballot at a smaller scale; drafting with a local model is
deferred until M1 has been used; the site is Dani's own.

Requirements are numbered (`R-CAP-3`) so code, tests and reviews can refer to them.
"Must" is required for v1, "should" is expected unless there's a reason not to, and
"may" is optional. Open questions are collected in §11 and referenced inline as `[Q3]`.

---

## 1. Purpose

Software that supports aisafety-media, Dani's workspace for
researching AI safety and producing content. It does three things:

1. **Capture.** Dani sends a link or note from the phone through Telegram in a few
   seconds. Nothing is lost if Dani's computer is off.
2. **Triage.** Captured pages are fetched on the server and their text and metadata
   stored, so that aisafety-media's `/news` can log them in bulk without fetching each
   one. RSS feeds in Miniflux give `/sweep` a reliable first pass.
3. **Publish.** PandorIA (`pandoria.es`), a public site in Spanish and English, Dani's own, shows short news items
   (_breves_) and articles that Dani has approved in aisafety-media.

## 2. Scope

**In v1:**

- Telegram bot → inbox → aisafety-media `/news` (queue mode)
- Fetching and text extraction on the server
- Miniflux as the first source for `/sweep`
- Public site for breves, in Spanish and English, fed only from aisafety-media

**Out of v1:**

- Drafting with a local model: decided after M1 has been used (§8.2, `[Q4]`)
- Social posting (Postiz)
- Automatic publishing of anything
- Multiple contributors (designed for, not built: `[Q6]`)
- Logging Miniflux entries into the inbox automatically
- An admin web UI (the bot and the API cover v1)
- n8n. It isn't part of the system; it may later run side jobs that call the API
  (R-RSS-4).

## 3. Context

**aisafety-media** (content repo, private) is the record. Its rules apply here,
especially:

- _no source, no claim_;
- _never invent a URL, date, number or quote_;
- _who reads it decides the language_: internal text in English, audience-facing text in
  the piece's language, usually Spain Spanish.

The news log is one file per item, `news/YYYY/MM/YYYY-MM-DD-slug.md`, written by `/news`
and `/sweep` and indexed by `tools/news.py` there. Tags and alert rules live in
`news/watchlist.md`.

**The site is Dani's own.** Its about page says who Dani is, including that Dani
collaborates with Pausemos la IA ("colaboro con Pausemos la IA"; in English, "I collaborate
with PauseAI"), but the site doesn't speak for the organisation
and needs no review by it.

**The stack** follows aiontheballot (its ADR-0001, hosting, and
ADR-0003, application stack) at a smaller scale. §15 lists what's kept and what's left
out.

**Infrastructure** is Dani's, managed in a private gitops repo with Argo CD. This repo is
public (D6), so it names none of it: hosts, addresses and how the cluster is laid out
live in gitops, and the sealing scripts read them from an untracked `scripts/ops.env`.
What the system relies on:

| Service                            | Used for                                                                |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Kubernetes, Argo CD, SealedSecrets | Running the system, deployed from this repo's umbrella chart            |
| PostgreSQL 18                      | The `newsroom` database, on a shared instance reachable only in-cluster |
| A public gateway (Gateway API)     | The public hosts: the API's and the site's (D8, D12)                    |
| A private container registry       | The images the release pushes                                           |
| A self-hosted runner               | Building releases, started by hand (§15)                                |
| GlitchTip                          | Server-side errors, sent inside the cluster                             |
| Plausible                          | Cookieless analytics                                                    |
| Miniflux                           | RSS for `/sweep`, its API behind a token                                |

**The Mac** is Dani's computer. It runs aisafety-media's commands, and nothing in the
cluster can open a connection to it.

## 4. Principles

- **P1. aisafety-media is the record.** The newsroom holds pipeline state and published
  copies. Everything that matters can be rebuilt from aisafety-media. The posts table
  can always be repopulated by re-pushing.
- **P2. Machines extract; Dani and the repo decide.** Page metadata and extracted text
  (and a model's draft, if M2 goes ahead) are hints. Nothing extracted is published, and
  `/news` confirms it against the page before logging.
- **P3. Nothing public without Dani's approval.** There is no automated path from
  capture to the public site.
- **P4. Capture doesn't depend on the Mac.** Capture, fetching and storage run on the
  cluster. Only aisafety-media's commands run on the Mac.
- **P5. Idempotent and boring.** Every operation can be retried safely. State
  transitions are explicit.
- **P6. No secrets in any repo.** Secrets live in sealed secrets (gitops) and the macOS
  Keychain.
- **P7. One data layer.** Only the API and its worker touch Postgres. The public site
  holds no database credentials, and has no sessions or cookies.

## 5. Architecture

```text
Phone ─▶ Telegram ─▶ [public] <host>/telegram/webhook ─▶ api ──────┐
                                                                   │
                     worker: fetch + extract ──────────────────────┼─▶ Postgres
                        └─▶ the web (public addresses only)        │   newsroom
                                                                   │
Readers ─▶ [public] <site>/, /en ───▶ web ─▶ api public read routes ─┘
                                          (in-cluster only, read-only role)

Mac ─▶ [public] <host>/api/v1 ─▶ api   inbox (/news), posts (/post), bearer token
Mac ─▶ [public] Miniflux               /sweep, Miniflux token
```

Everything except Telegram, Miniflux, the readers and the Mac runs on the cluster, in the
`aisafety-newsroom` namespace.

### Components

| ID   | Component                      | Built as                                                                       |
| ---- | ------------------------------ | ------------------------------------------------------------------------------ |
| BOT  | Telegram capture and commands  | Fastify routes in `apps/api`                                                   |
| WRK  | Fetch and extract              | `apps/api`'s second entrypoint (`dist/worker.js`), its own Deployment          |
| API  | Inbox API and posts API        | Fastify routes in `apps/api`, behind a bearer token                            |
| DB   | `newsroom` database            | Shared Postgres; dbmate SQL migrations in `db/`                                |
| SITE | Public site                    | Next.js in `apps/web`                                                          |
| CLI  | `tools/newsroom.py` on the Mac | Lives in **aisafety-media**, since it's content tooling; contract defined here |

**Hosts.** Two, on the public gateway, and configuration, never code (D8, D12): the
API's `<host>` is `newsroom.danilupion.com`, where only `/telegram/webhook` and
`/api/v1/*` are routed; the site's `<site>` is `pandoria.es`, Spanish at its root and
English under `/en/` (D10; `www.pandoria.es` redirects there). The site reads the API
inside the cluster, so it never calls the API's host.

The API's public read routes are on no gateway: only the web pods reach them, through
the Service, and a NetworkPolicy enforces it.

## 6. Capture (BOT)

- **R-CAP-1** Must: a Telegram bot, created with BotFather, used in private chat only.
  Messages from Telegram user IDs outside the allowlist (config) are ignored without a
  reply.
- **R-CAP-2** Must: Telegram delivers updates by webhook to `/telegram/webhook` on the
  API host. The API registers the webhook with a `secret_token`, and refuses (`401`) any request whose
  `X-Telegram-Bot-Api-Secret-Token` doesn't match, compared in constant time. Each
  `update_id` is processed once, so Telegram's redeliveries are harmless.
- **R-CAP-3** Must: extract URLs from the message text or caption, using Telegram
  entities (`url`, `text_link`). This includes forwarded messages. The note is the text
  with the URLs removed. If a message has several URLs, create one item per URL, each
  with the same note.
- **R-CAP-4** Must: a message with no URL creates a note-only item that goes straight
  to `needs_review`.
- **R-CAP-5** Must: normalise the URL:
  - lowercase the scheme and host;
  - drop the fragment;
  - drop tracking parameters: `utm_*`, `fbclid`, `gclid`, `igshid`, `ref`, `s` and `t`
    on x.com, and `si`, `feature` and `pp` on YouTube;
  - treat `twitter.com` as `x.com`;
  - drop the trailing slash;
  - write every link to a YouTube video (`watch?v=`, `youtu.be/`, `/shorts/`, `/live/`,
    `/embed/`; on `www.`, `m.` and `music.youtube.com` too) as
    `https://www.youtube.com/watch?v=<id>`, with nothing else: a start time (`t`) doesn't
    make another source, and the item's `url` keeps the link as sent.
- **R-CAP-6** Must: deduplicate on the normalised URL. When an item already exists:
  - if it's still open (`queued`, `ready` or `needs_review`), append the new note to it
    and reply "Already saved #17 (status)";
  - if it's `logged` or `discarded` and the message has a note, create a follow-up: a
    note-only item in `needs_review` that points at #17 (`follows_up`), and reply
    "Already logged as #17; your note is #58", so the note reaches `/news` (R-MED-2);
  - with no note, just reply "Already saved #17 (status)".
- **R-CAP-7** Must: reply within 5 s with "Saved #42". It should edit that reply once
  the worker is done: "#42 · <page title>" from the page's metadata, or "#42 · couldn't
  fetch it" when the item moves to `needs_review`.
- **R-CAP-8** Must: bot commands:
  - `/pending`: up to 20 unlogged items, with id, status, and title or host, those to
    log only marked "· log only";
  - `/log <link> [note]`: saves the link like a plain message, but to log only (D18); a
    link already in the inbox gets the note as usual (R-CAP-6) and becomes log only. A
    plain link, a caption or a forward is to be posted;
  - `/log <id>` and `/post <id>`: switch an item between log only and posted, replying
    with its title or host like `/discard`. A discarded item is refused; a logged one is
    switched, with a warning that its post may already be on the site (`/takedown`);
  - `/discard <id> [reason]`, which replies with the item's title or host, so a wrong
    id is noticed at once;
  - `/restore <id>`: brings a discarded item back (R-DB-1);
  - `/note <id> <text>`;
  - `/help`.
- **R-CAP-9** Should: record `submitted_by` (the Telegram user id) on each item, ready
  for more contributors later `[Q6]`.
- **R-CAP-10** Must: `/images [on|licensed|off]` turns the site's images down from a
  phone, in seconds: `on` shows lead images and the sources' previews, `licensed` only the
  lead images (the previews, the outlets' photos, are the riskier copies), `off` none.
  Never the share cards (R-WEB-14), the site's own. One switch in the database
  (`app.site_settings`), read by the public views on every request, so the next page and
  the next image request follow it; with no settings row, no image (fails closed).
  `/images` alone says how it stands.
- **R-CAP-11** Must: `/takedown <post>` hides a story at once, both versions (`410`,
  like an unpublished one, D11); the post is named as `es/<slug>`, `en/<slug>`, a bare slug
  (Spanish first, since Spanish is at the root) or its address copied from the site. It
  sets `taken_down_at`, which only the bot sets and clears: a push, a rebuild's included,
  never brings a taken-down story back, and aisafety-media's `/post` sees it to record the
  decision (R-MED-7). `/takedown image <post> [lead|<n>]` hides a post's images (both
  versions' with no choice), its lead image, or source n's preview: the image itself is
  marked removed, so it stays hidden wherever it's used, whatever a later push names.
  `/restore <post>` and `/restore image <post> [lead|<n>]` undo either; `/restore <id>`
  still restores an inbox item. Each reply names the post's title or the image's credit,
  so a wrong target is noticed at once. Taking down shows at once; a restore can take up
  to a minute, the site's own list of gone posts (R-WEB-6).
- **R-CAP-12** Should: `/takedown entity <id>` hides an entity (D23) at once: its page
  answers 404, it leaves the index, and no post names it or links to it any more; the
  stories themselves stay. The entity is named by its id or its page's address copied
  from the site. It sets the entity's `taken_down_at`, which only the bot sets and clears,
  like a post's: a push never clears it, and `GET /entities` shows it to aisafety-media.
  `/restore entity <id>` undoes it. The people on these pages are public figures and the
  pages list only stories, but someone may still ask.

## 7. Inbox store (DB)

A `newsroom` database on the shared Postgres. Migrations live in `db/migrations/`: plain
SQL, run by dbmate, forward-only, one concern each. `db/schema.sql` is the generated dump
and is reviewed in every PR.

**Roles.** None of the runtime roles own anything:

- `newsroom_owner` owns the tables and is used only by the migration Job;
- `newsroom_app` is used by the API and the worker;
- `newsroom_public` is used by the API's public read routes, and may only read published
  posts, the images they show (`app.public_images`) and the entities they name
  (`app.public_entities`), through views; never a table.

**Images and switches.** `app.images` keeps each uploaded image (R-API-5) as the API
re-encoded it, keyed by the SHA-256 of what was sent; `removed_at` marks one the bot took
down (R-CAP-11), and nothing is ever deleted. Its bytes are files on the API's volume
(D22): the database keeps what each image is (its size in pixels and in bytes) and whether
it may be shown, the volume the WebP files; an API without the volume stores and serves no
image (503). The database holds no image bytes at all (D22's move is complete).
`app.site_settings` is one row, the image
switch (R-CAP-10). The views decide what's public on every read: `published_posts` gives
a lead image (with its size) or a source's preview only while the switch and removals
allow it, and leaves out a taken-down story; `public_images` lists only the files a
published post shows.

**Entities.** `app.entities` is a copy of aisafety-media's registry (D23), one row per
entity, pushed by `PUT /entities/:id`: its type, its name and its name in a language where
that's another, a description in each language, its Wikidata item. Nothing is deleted:
`DELETE /entities/:id` sets `deleted_at` and a push clears it; `taken_down_at` is the bot's
(R-CAP-12). A post lists its entities' ids in `posts.entities`, in order. An array holds no
foreign key, so two triggers do its work (R-API-6): a post names only entities in the
registry and not deleted, and an entity a post names can't be deleted (both raise
`posts_entities_known`); a push locks the entities it names, so a push and a deletion never
cross. `published_posts` gives each post's entities in its language, leaving out hidden
ones, and `public_entities` lists, for each language, every entity a published story names,
with its name and description in that language and its count of stories.

### `inbox_items`

| Column                                              | Type                        | Notes                                                               |
| --------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| `id`                                                | bigint identity PK          | shown to Dani as `#id`                                              |
| `created_at`, `updated_at`                          | timestamptz                 |                                                                     |
| `submitted_by`                                      | bigint                      | Telegram user id                                                    |
| `source`                                            | text                        | `telegram` in v1                                                    |
| `raw_text`                                          | text                        | the original message                                                |
| `url`, `url_normalized`                             | text                        | unique index on `url_normalized` where not null                     |
| `note`                                              | text                        | notes appended with timestamps                                      |
| `follows_up`                                        | bigint, FK to `inbox_items` | for a note sent about an item already logged or discarded (R-CAP-6) |
| `status`                                            | enum                        | `queued`, `ready`, `needs_review`, `logged`, `discarded`            |
| `intent`                                            | enum                        | `post` (default) or `log`: a post too, or the log entry only (D18)  |
| `fetch_status`                                      | enum                        | `pending`, `ok`, `failed`, `skipped`                                |
| `fetch_attempts`, `next_fetch_at`                   | int, timestamptz            | retries with backoff                                                |
| `http_status`, `final_url`, `content_type`          | int, text, text             |                                                                     |
| `page_title`, `page_site_name`, `page_published_at` | text                        | from page metadata, verbatim                                        |
| `page_published_on`                                 | date, generated             | the day `page_published_at` names, when it's an ISO date (R-API-4)  |
| `page_text`                                         | text                        | extracted main text, ≤ 20,000 chars; cleared after 90 days `[Q9]`   |
| `page_kind`, `page_author`, `page_duration_seconds` | text, text, int             | `page` or `video`; a video's channel and its length (R-FET-7)       |
| `fetched_at`, `logged_at`                           | timestamptz                 |                                                                     |
| `logged_ref`                                        | jsonb                       | `{news_file, entry_date, tags, relevance}` from aisafety-media      |
| `discard_reason`, `last_error`                      | text                        |                                                                     |
| `reply_chat_id`, `reply_message_id`                 | bigint                      | the "Saved #n" reply, so it can be edited                           |

`telegram_updates` keeps each processed `update_id` (R-CAP-2). `notifications` keeps when each
message through `POST /notify` went out (`sent_at`, never its text), for its hourly limit (D20).

### State machine

```text
queued ──fetched, or host skipped──▶ ready ─────┐
   │                                            ├──▶ logged      (aisafety-media)
   └──no URL / 3 failed fetches──▶ needs_review ┴──▶ discarded   (aisafety-media or /discard)
                                                         │
                                       restore ◀─────────┘      (/restore or the API)
```

- **R-DB-1** Must: only the inbox API or the bot can move an item to `logged` or
  `discarded`, or restore it. An invalid transition returns `409`. The transitions
  should be enforced by a trigger as well, so a bug in the code can't skip them.
  - `logged` is final. Marking it `logged` again with different details only updates
    `logged_ref`, which is just a pointer into aisafety-media (P1).
  - A `discarded` item can be restored. It goes back to `queued` if it was never
    fetched, to `ready` if it was fetched or skipped, and to `needs_review` otherwise.
- **R-DB-2** Must: items are never deleted in v1.

## 8. Fetch and extract (WRK)

### 8.1 v1

- **R-FET-1** Must: the worker is its own Deployment, with one replica, from the API's
  image. At least once a minute it claims up to 10 `queued` items that are due
  (`FOR UPDATE SKIP LOCKED`), so a new item is usually fetched within a minute.
- **R-FET-2** Must: fetch and extract:
  - browser-like User-Agent, 15 s timeout, at most 5 redirects;
  - HTML up to 5 MB, PDFs up to 30 MB, counted once decoded;
  - main text with Mozilla Readability on jsdom, and metadata (`og:title`,
    `og:site_name`, `article:published_time`, `<time>`); PDF text and title with
    pdfjs-dist. These are the libraries aiontheballot uses (its ADR-0003 §9).

  3 failed fetches, 1 and then 10 minutes apart → `needs_review`. A page that's gone (`404`,
  `410`), or a link R-FET-4 refuses, goes there at once. The bot's "Saved #n" reply is edited
  either way (R-CAP-7).

- **R-FET-3** Must: hosts that block fetching, starting with `x.com` and `axios.com`
  (Cloudflare's bot protection), are skipped (`fetch_status: skipped`). The item goes to
  `ready` and relies on the note. The host list is configuration.
- **R-FET-4** Must: the worker reaches only the public internet:
  - its NetworkPolicy allows DNS, Postgres, GlitchTip, and ports 80 and 443 on every
    address except the private, loopback, link-local, shared and multicast ranges;
  - the code also checks: `http` or `https` only, no user name or password in the URL,
    port 80 or 443, and every address the name resolves to is public, checked in the
    connection's own lookup, as aiontheballot's fetcher does (its ADR-0007 §2); each
    redirect is checked the same way;
  - it sends no cookie and no referrer.
- **R-FET-5** Must: an attempt is counted when the item is claimed, before fetching, so a
  page that crashes the worker ends in `needs_review` after 3 tries instead of looping.
- **R-FET-6** Must: page content is untrusted data. It is stored as text, rendered
  nowhere public, and never followed as instructions.
- **R-FET-7** Must: a link to a YouTube video (R-CAP-5) is read from the video's watch
  page, whatever form was sent, and the item is marked as a video (`page_kind: video`;
  any other fetch is a `page`):
  - from the page's player data (`ytInitialPlayerResponse`, read as JSON up to its
    closing brace and never run): the title, the channel (`page_author`), the full
    description as the item's text, the length (`page_duration_seconds`; none for a
    stream still on the air) and the publication date. Data about another video is
    ignored;
  - a page without that data (YouTube may show a data centre's address a "confirm you're
    not a bot" page, or a consent page) gets the title and the channel from YouTube's
    public oEmbed endpoint, fetched under R-FET-4's rules; if that fails too, the page's
    own metadata stands;
  - the bot's edited reply adds the length and the channel:
    "#42 · <title> (video, 13 min, <channel>)".

  The transcript isn't fetched here (R-MED-6).

### 8.2 Drafting with a local model (M2, not committed)

Decided after M1 has been used for a couple of weeks. It goes ahead only if `/news`
queue mode is too slow or too costly with the stored text alone `[Q4]`. Note that
`/news` reads the page text either way (P2), so a model mostly saves writing, not
reading. If it does go ahead:

- The cluster can't reach the Mac, so the Mac pulls: a scheduled job (launchd) claims
  `ready` items through the API, runs Ollama on localhost, and posts the drafts back.
  Items without a draft are still logged as in v1.
- The output is JSON constrained by a schema (Ollama's `format`):
  `{title, outlet, published_date, summary_en (≤ 60 words), tags, relevance,
primary_url}`. The page text goes in delimited, as untrusted data, and the prompt says
  to ignore any instructions inside it.
- The API validates a draft before saving it: tags only from the allowed list (pushed
  from `news/watchlist.md` through `PUT /api/v1/config/tags`); `primary_url` must be one
  of the page's own links; `published_date` must match the metadata or appear in the
  text; the summary is capped at 60 words. Otherwise the field is null.
- The model is picked by running the candidates on 20 real items and comparing against
  `/news` output. The Mac's memory decides how large a model fits.

## 9. Inbox API

Fastify routes under `/api/v1/` on the API host. Requests and responses are JSON,
validated with zod schemas that the tests share.

- **R-API-1** Must: every request carries `Authorization: Bearer <token>`, compared in
  constant time. Wrong or missing token → `401`.
- **R-API-2** Must: the host is public, so the token is the only lock. Anyone holding it
  can read the inbox and publish to the site. So:
  - it's random, 256 bits or more, generated by the seal script;
  - it lives only in the sealed secret and the Mac's Keychain;
  - it travels only in the header over HTTPS, never in a URL;
  - it's never logged, and error reports keep no request header but the user agent;
  - rotating it is a runbook (§15).
- **R-API-3** Must: all writes are idempotent. Repeating `logged` with the same body
  returns `200`; with a different body it updates `logged_ref` and returns `200`
  (R-DB-1). Restoring an item that isn't discarded returns `200` if it's already open,
  `409` if it's logged.
- **R-API-4** Should: `GET /items` lists as found (oldest first, the default) or, with
  `sort=source`, by the day each page says it was published, oldest first and undated
  ones last, so a story sent today about something weeks old stands out (D16). The day is
  read from `page_published_at` when it starts with an ISO date; nothing else is guessed.

| Method and path             | Body or query                                                                                       | Returns                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /items`                | `status=ready,needs_review` (default), `limit` (≤ 50), `sort=found` (default) or `source` (R-API-4) | items without `page_text`, with `page_excerpt` (first 4,000 chars) and `intent`; a follow-up also carries its original's id, URL, status and `logged_ref`                                     |
| `GET /items/:id`            |                                                                                                     | the full item, including `page_text` and `intent`                                                                                                                                             |
| `POST /items/:id/logged`    | `{news_file, entry_date, tags, relevance}`                                                          | `200` with the item                                                                                                                                                                           |
| `POST /items/:id/discarded` | `{reason}`                                                                                          | `200` with the item                                                                                                                                                                           |
| `POST /items/:id/restored`  |                                                                                                     | `200` with the item                                                                                                                                                                           |
| `POST /items/:id/note`      | `{text}`                                                                                            | `200` with the item                                                                                                                                                                           |
| `POST /notify`              | `{text}`, 1–4,000 characters after trimming                                                         | `200 {sent: true}`: the bot sends it to Dani's chat as plain text, link previews off; `429` above 30 an hour, counted across replicas; `503` without the bot; `502` if Telegram refuses (D20) |

Errors are `{ "error": "message" }` with `400`, `401`, `404` or `409` (and `429`, `502`
or `503` from `/notify`).

## 10. Consumers in aisafety-media

These are requirements on the content repo, implemented there.

- **R-MED-1** Must: `tools/newsroom.py`, Python stdlib only. It reads `NEWSROOM_API_URL`
  and `NEWSROOM_TOKEN` from the environment, falling back to the macOS Keychain (service
  `aisafety-newsroom`, account `api-token`, stored there by `scripts/seal-gitops-secrets.sh`).
  Subcommands:
  - inbox: `pending`, `show <id>…`, `logged <id> <item file>` (the date, tags and
    relevance come from the file, which must pass `tools/news.py`'s check),
    `discard <id> <reason>`, `restore <id>`, `note <id> <text>`;
  - posts: `check [post…]` (offline), `post <path>` (only `approved` or `published`,
    and committed: `content_ref.commit` is the file's last commit), `post --all`
    (R-WEB-8), `unpublish <lang>/<slug>`, `posts` (to reconcile);
  - `sync-tags` (parses `news/watchlist.md`), only if M2 goes ahead.

  The token goes only to the API host, in the header: redirects aren't followed, and a
  non-local `http://` address is refused.

- **R-MED-2** Must: `/news` with no arguments runs in queue mode. For each pending item:
  1. use the stored title, outlet, date and text; fetch again only if the text is
     missing (skipped or failed) or isn't the article (a cookie wall, a login page);
  2. deduplicate against `news/` and `sources/` (`tools/news.py dup`);
  3. write the item file in English in our own words (`origin: telegram`,
     `newsroom: <id>`). A follow-up (R-CAP-6) adds its note to the original's item file,
     found through its `logged_ref`, instead of writing a new one;
  4. run the alert check;
  5. mark the item `logged`, or `discarded` with a reason.

  It drafts a post for each item whose `intent` is `post` and only logs those marked
  `log` (D18); a missing `intent`, from an older API, counts as `post`. It uses no agents.
  The reply is one line per item.

- **R-MED-3** Must: `/news <url>` (direct mode) keeps working without the newsroom.
- **R-MED-4** Must: `/sweep` reads Miniflux first (§12), then has the `researcher` agent
  cover only what the feeds don't.
- **R-MED-5** Must: new content types:
  - `posts/<lang>/YYYY-MM-DD-slug.md` for breves, `posts/<lang>/<slug>.md` for pages
    (`posts/es/sobre.md`, `posts/en/about.md`), the folder giving the language: English
    frontmatter, the body in the post's language, status `draft → approved → published`,
    or `unpublished`. `sources:` lists ids of files in `sources/`, so everything the site
    cites was fetched and checked there. Every post has its version in the other
    language, which names its original as `translation_of: <lang>/<slug>` (R-WEB-10);
  - `format: article` pieces, with `article.md` as the body.

  `/breve` drafts a breve in both languages, `/post <lang>/<slug>` pushes an approved story
  (both versions) to the site, and only Dani sets `approved`.

- **R-MED-6** Must: for a video (R-FET-7), `/news` has its description, channel and length
  from the newsroom. When writing about what is said in it, the transcript is fetched on
  the Mac, at that moment, never by the worker: YouTube is hardest on data centres'
  addresses, and transcripts are what it guards most.
- **R-MED-7** Must: images and takedowns in aisafety-media (D17).
  - A post's front matter may name a lead image: `image: {file, alt, credit, licence,
source_url}`, the file under `images/` in aisafety-media, an image under a clear
    licence (never a publisher's photo, never AI-generated), alt text in the post's
    language. A source file in `sources/` may name its outlet's preview: `preview: {file,
credit}`, the file under `sources/previews/`, saved when the source is fetched. The
    files stay in the repo, so a rebuild (R-WEB-8) sends the same bytes.
  - `/post` uploads each image first (`PUT /images/<sha256>`, skipped when `GET` finds it),
    then pushes the post naming them; `check` validates the fields and that the files exist.
  - `newsroom.py posts` shows a story the bot took down (`taken_down_at`) and an image it
    removed (`GET /images/<sha256>`'s `removed_at`). `/post` then stops and asks: record
    the takedown (`unpublish`), or bring the story back with the bot's `/restore`.
- **R-MED-8** Must: `tools/newsroom.py notify` tells Dani what an unattended run did (the
  launchd job that runs `/news auto` every two hours) through the bot (`POST /notify`,
  D20). While the route answers 404 (an older API), it keeps the messages in a local
  outbox and sends them once it answers.
- **R-MED-9** Must: entities come from aisafety-media's registry, `entities/<id>.md` (D23).
  `/post` pushes the entities a story names (`PUT /entities/<id>`) before the story, and
  the story's `entities:` with each version; `post --all` pushes the whole registry first
  and deletes what it no longer has last (R-WEB-8). An API older than entities refuses the
  field (`Unrecognized key: "entities"`, as for `quotes`): the story waits for the release
  that takes it. `newsroom.py posts` shows an entity the bot hid (`taken_down_at`), as it
  shows a story taken down.

## 11. Open questions

| #   | Question                                              | Leaning                                        |
| --- | ----------------------------------------------------- | ---------------------------------------------- |
| Q4  | Is drafting with a local model worth building? (§8.2) | Decide after using M1                          |
| Q6  | Will others send items later?                         | Designed for, not built                        |
| Q7  | Articles in v1, or breves first?                      | Breves first                                   |
| Q8  | Which "Where to look" sources have usable feeds?      | Checked: the watchlist's Feeds (2026-10-15)    |
| Q9  | How long to keep `page_text` (size, copyright)?       | Clear it 90 days after `logged` or `discarded` |

### Decided (v0.2–v0.4)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Was          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| D1  | The bot, API, worker and database run on Dani's Kubernetes cluster; n8n isn't part of the system                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Q2, Q3       |
| D2  | The inbox lives in a `newsroom` database on the shared Postgres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Q2           |
| D3  | The site is Next.js, rendered on the server from the API; no rebuild per post                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Q5           |
| D4  | The site is Dani's own; the about page says Dani collaborates with Pausemos la IA; no review by the organisation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Q1 (in part) |
| D5  | Drafting with a local model waits until M1 has been used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Q4           |
| D6  | The repo is `github.com/danilupion/aisafety-newsroom`, public, AGPL-3.0-or-later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —            |
| D7  | The inbox and posts API are on a public host behind a bearer token, not on a private network                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —            |
| D8  | The API's host is `newsroom.danilupion.com`, under `/api/v1` and `/telegram/webhook`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Q1 (in part) |
| D9  | The news log is one file per item; `news_file` is `news/YYYY/MM/YYYY-MM-DD-slug.md`, not a month file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —            |
| D10 | The site is in Spanish and English from v1, on one host: Spanish at the root, English under `/en/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Q1 (in part) |
| D11 | Every post is published in both languages; the site shows a story only when both versions are                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Q11          |
| D12 | The site is PandorIA, at `pandoria.es`, the same name in both languages; its look is the night design with the box mark (R-WEB-11)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Q1           |
| D13 | Miniflux waits: Dani checks the sources by hand for now, and R-RSS-1–3 apply once it's set up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —            |
| D14 | The texts (breves, articles) are CC BY 4.0, like aiontheballot's content: the footer links the licence, and the feeds state it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Q10          |
| D15 | A breve's 80–150 words apply to the language it's written in; its translation says the same, at whatever length                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Q12          |
| D17 | Images (R-WEB-14–16): every page has the site's own share card (title and mark on navy, generated by the site); a post may have a lead image under a clear licence, credited; a source may show its outlet's preview, small and credited, a copy whose risk the bot's switches (R-CAP-10) and per-image removal (R-CAP-11) manage. Always copies the site serves from its own host, never hotlinks; never AI-generated (R-WEB-3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Q13          |
| D18 | Almost every link Dani sends becomes a post as well as a log entry: an item's `intent` is `post` unless Dani says `log` (`/log <link>`, `/log <id>`; `/post <id>` switches back). The bot is the only place it changes; aisafety-media reads it (R-MED-2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —            |
| D19 | Every AI-written post carries its own label, "Escrito con IA", on its card and on its page, beside its type and date; a post a person wrote names them (`author`) as a badge instead. Dani doesn't always read every text in full, so the AI Act's exemption for text under human review (Art. 50(4)) isn't relied on, and the site never says texts are checked: it says AI writes them from the linked sources and Dani picks the stories, which is always true                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —            |
| D20 | aisafety-media tells Dani what its unattended runs did through the bot: `POST /api/v1/notify` sends plain text, link previews off, to Dani's private chat with the bot, whose id is the first allowed user id (R-CAP-1). At most 30 messages an hour, counted in `app.notifications` under a lock so two replicas can't both take the last place; the text is never logged or stored                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —            |
| D21 | A quotation from a social network post is drawn by the site as a quote card (R-WEB-17), never a screenshot or an embed: it keeps the site's look, stays real text (readable, searchable, translatable), is a short credited quotation linked to its original, and loads nothing that tracks readers. A screenshot is only evidence, for a post that might be deleted, kept in aisafety-media and never published                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —            |
| D22 | Images' bytes live as files on the API's volume, named by their SHA-256; the database keeps their metadata and decides what's shown (R-CAP-10, R-CAP-11). Database dumps stay small once backups exist, serving reads a file instead of the database, and the originals stay in aisafety-media, so the volume needs no backup of its own. In steps: 1, the API wrote both, served the file and copied every image in (`GET /images` counts what's on the volume); 2a, the database stops taking bytes and serving reads only the file, a missing one a 404 logged by its SHA-256; 2b, once 2a was live and the count clean, a migration dropped the byte columns. Done: the bytes are only on the volume, the metadata only in the database. A node-local volume is enough on one node; past one, object storage                                                                                                                                                                                                                                                                   | —            |
| D23 | Entities, the people, organisations and laws a story is about, are a second dimension beside its topics, stored apart from the tags: a table of their own (`app.entities`, a copy of aisafety-media's registry, `entities/<id>.md`, which is the record, P1) and a list of ids on each post (`posts.entities`), never `entity:<id>` tags mixed into `tags` (rejected in aisafety-media: a tag has no type, no name in each language, no description, no Wikidata item). A list on the post like its tags, not a join table: the post stays one row written by one statement (P5), its list keeps its order, and the runtime role needs no DELETE (R-DB-2); two triggers do a foreign key's work (R-API-6). Each version of a story carries its own list, and aisafety-media gives both the same; a page has none. Nothing is deleted: `DELETE /entities/:id` marks one, refused while a post names it. Public only through views, in the reader's language, with its Wikidata item for search engines (R-WEB-21); hidden by the bot, an entity leaves everything public (R-CAP-12) | —            |
| D16 | Three dates, each where it fits: found (the inbox's `created_at`, its default order), the page's own day (the inbox's second order, R-API-4), and for a post its posted day (`published_at`: the site's default order, the feeds and the sitemap) and its news day (`news_date`: the site's second order, R-WEB-13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —            |

## 12. Miniflux for `/sweep`

- **R-RSS-1** Must: a Miniflux category (e.g. `aisafety`) with feeds for the sources in
  `news/watchlist.md` › Where to look. The watchlist notes which sources have a feed
  and which still need a direct check `[Q8]`.
- **R-RSS-2** Must: `/sweep` reads the category's unread entries published after
  `last_sweep` through the Miniflux API (`X-Auth-Token`; check the endpoints against
  the deployed version). The lead session triages them by title and summary, opens only
  the candidates, logs them, and marks the processed entries read.
- **R-RSS-3** Must: `MINIFLUX_URL` (Miniflux's address; its API is behind the token)
  and `MINIFLUX_TOKEN` come from the environment or the Keychain (service
  `miniflux`, account `api-token`), read by aisafety-media's `tools/miniflux.py`.
  Everything it does stays inside the category.
- **R-RSS-4** May (later): Miniflux entries that match a keyword list go into the inbox,
  through the API, from the worker or from an n8n workflow.

## 13. Public site

### Content

- **R-WEB-1** Must: two content types, each written in Spanish or English:
  - **breve**: a title, 1–3 sources, 80–150 words in the language it's written in; its
    translation says the same at whatever length that takes, with no limit of its own (D15);
  - **article**: long form.

  Each lists its sources (title, link, access date) and its tags.

- **R-WEB-2** Must: content comes only from aisafety-media through the posts API.
  Nothing from the inbox reaches the site (P2, P3).
- **R-WEB-3** Must: no AI-generated images; non-partisan; honest about uncertainty.
  Open about how it's made, promising only what's always true: texts are written by AI
  from the linked sources, and Dani picks the stories. Every AI-written post says so where
  a reader first meets it: "Escrito con IA" ("Written with AI") in its card's line and in
  its line under the tag, beside its type and date, plus the note above its sources, and
  each feed entry at its end. Every page's footer says "Textos escritos por IA a partir de
  las fuentes enlazadas y elegidos por" Dani (linked to a page about Dani when gitops gives
  one), "salvo los firmados", and links the about page ("Sobre PandorIA"), which explains
  the process. A post a person wrote carries their name instead (`author`, D19): "Escrito
  por <name>" as a badge on its card, in its line under the tag and in its feed entry, with
  no AI note. A translation with no name of its own, of a signed original, says it was
  translated with AI ("Escrito por <name> · traducción con IA", and a translation note
  above its sources). The site never claims that every text was checked. The site doesn't
  speak for Pausemos la IA.
- **R-WEB-10** Must: every post is published in Spanish and English (D11): written in
  one language and translated into the other. A translation names its original, which
  has been pushed already; a story is one original and its translation, never a
  translation of a translation (the database enforces it). The site shows a story only
  when both versions are published, so no reader finds one language alone, not even
  between the two pushes; taking either version down takes both down (`410`). Each
  version links to the other, visibly and for search engines (`hreflang`).

**Pages,** Spanish at the root and English under `/en` (D10), each in its own words:

| Page                       | Spanish           | English         |
| -------------------------- | ----------------- | --------------- |
| Latest items, continuous   | `/`               | `/en`           |
| One item                   | `/<slug>`         | `/en/<slug>`    |
| A tag's items (named tags) | `/etiqueta/<tag>` | `/en/tag/<tag>` |
| Topics index               | `/temas`          | `/en/topics`    |
| An entity's items          | `/quien/<id>`     | `/en/who/<id>`  |
| Entities index             | `/quien`          | `/en/who`       |
| About                      | `/sobre`          | `/en/about`     |
| Search                     | `/buscar?q=`      | `/en/search?q=` |
| Atom feed                  | `/feed.xml`       | `/en/feed.xml`  |

`/` is the Spanish home for every reader, whatever their browser asks for: the main
readers are in Spain, and each page links to the same page in English. `/es` and every
address under it answer `301` to the same address without the prefix, so a link written
with it still works. The sitemap lists both languages. An address that is no page, or no
published post, tag or entity, answers 404 with the not-found page of its language, its
text in the page itself: the site's proxy tells them (asking the API about a post, a tag
or an entity) and
serves that page with the status, since a page's own not-found is drawn by script. The
about page's text is a post of type `page` whose slug is its language's word (`sobre`,
`about`), pushed from aisafety-media like the rest (R-WEB-2): pages are never listed,
need no sources, and nothing on the site is written in its code. The ten path words, the
two languages' prefixes, `healthz`, and `img` and `og` (the images' and the share cards'
folders, D17), which share the root with Spanish posts, are refused as slugs in both
languages, so no post hides behind a page.

- **R-WEB-4** Must: a Spanish and an English interface, each language's own labels,
  dates and tag names, and a link to the other language labelled in that language; Open
  Graph and canonical metadata; usable at phone width; accessible (semantic HTML,
  `lang` on every page, contrast, alt text; WCAG 2.2 AA as the target).
- **R-WEB-11** Should: the look of D12. One dark theme: navy `#0F172A`, cards `#1E293B`.
  Two accents with set roles: aquamarine `#7FFFD4` is the workhorse (links, tags, dates,
  buttons, the order and language switches, focus); hot pink `#FF4FD8` is for highlights
  only (the mark's glow, a breve's timeline dot, the video play button, a followed link's
  bar) and never carries small text. Text on either fill is navy, and every text colour
  passes AA on the ground it sits on. One typeface, Hanken Grotesk, served by the site
  itself. The mark: Pandora's box with its lid ajar, aquamarine tentacles coming out of it
  and hot pink light pouring from the gap, in the header, as the site's icon (the rising
  tentacle alone, at icon sizes) and as the bot's avatar; the name with its trailing "IA"
  in a gradient from aquamarine to pink. Taglines "La caja ya está abierta" and "The box
  is already open". No PauseAI colours, typeface or marks: the site is Dani's own (D4).
  The header's mark, about 58 px, is alive: on every full page load, reloads included (not
  on a move within the site), the box opens and the tentacles come out (about 1.7 s);
  after that the tentacles bend along their length, each in three segments with the bend
  travelling from root to tip and the tips curling slowly, the pink light breathes and
  the lid lifts a hair, all gently, and markedly wider and faster while the logo is
  hovered or focused; it rests out of view, never moves with prefers-reduced-motion, and
  every other use of the mark is still.
- **R-WEB-5** Must: Markdown is rendered to sanitised HTML. No raw HTML from posts.
- **R-WEB-6** Must: the web app reads posts from the API's public read routes inside the
  cluster, which use `newsroom_public` (P7). It caches each answer for at most 60 s.
- **R-WEB-7** Should: Plausible for analytics and nothing else (no cookie banner
  needed); GlitchTip for server-side errors. No error SDK in the browser in v1. Beyond
  Plausible, a page loads nothing from another host until a reader presses play on a
  video (R-WEB-12).
- **R-WEB-12** Should: a source that is a YouTube video plays on the site, but only when
  the reader asks. A card whose picture is that source's preview, and the top of the post,
  show the site's own still with a play button; pressing it puts YouTube's
  privacy-enhanced player (`youtube-nocookie.com`) in its place, playing there. Nothing
  reaches YouTube before that click (R-WEB-7), and the caption says the video loads from
  YouTube. The site's policy lets that one host into a frame, no other. The video's length
  and channel in the sources list aren't built yet.
- **R-WEB-13** Must: a breve or an article has a news date, the day its story happened
  as its original source dates it (`news_date`, a calendar day; a page has none; D16).
  Both versions of a story carry the same one, or the site shows neither, like D11. The
  timelines (the home and a tag's page) list as posted by default, so a story added late
  doesn't land deep in the list; a second order, "Por fecha de la noticia" / "By news
  date" (`?orden=noticia`, `?order=news`), lists by news date, newest first, each date
  column showing that day. As posted, a card whose story happened on another day says so
  ("noticia del 12 oct"), and so does the post's page. The feeds and the sitemap stay as
  posted. A push without a news date (a client older than them) is dated by its posted
  day on the site's clock, and so is a post pushed before them.
- **R-WEB-14** Must: every page has a share card, what a link to it shows on X, WhatsApp
  or Telegram (`og:image`, `twitter:card` `summary_large_image`): the site's own drawing,
  1200 × 630, the mark and the name, the title in large Hanken Grotesk on navy, the type
  or the tagline, and the host. A post's card is its own (`/og/<lang>/<slug>.png`); every
  other page has its language's home card (`/og/<lang>.png`). Never a lead image or a
  publisher's photo, never AI-generated (R-WEB-3); the switches don't touch it.
- **R-WEB-15** Should: a breve or an article may have a lead image under a clear licence
  (a Commons file, a press kit, a public-domain image; never a publisher's or an agency's
  photo, never AI-generated): shown on its page below the summary with its alt text in
  the post's language and a caption, "Imagen: <credit> · <licence>", the credit linked to
  where it came from; and small on its timeline card. A page has none.
- **R-WEB-16** Should: a source may show its outlet's preview image (the page's own
  `og:image`), small, beside its link in the post's sources, credited to the outlet
  ("Imagen: <outlet>"). Decorative there (empty alt): the link says what it is.

  Images (R-WEB-15, R-WEB-16) are always the site's own copies, served from its host
  under `/img/<kind>/<sha256>.webp` (`.thumb.webp` for the small one), never hotlinks: a
  reader's browser loads nothing from another host (R-WEB-7). The API re-encodes each
  upload: raster formats only (JPEG, PNG, WebP, GIF; never SVG), refused past 50
  megapixels before it's decoded, the first frame of an animation, turned upright, as
  WebP without any metadata (no EXIF, no location, no colour profile), at most 1600 px
  on its longer side and a 480 px thumbnail. A file is served only while a published post
  shows it as that kind and the switches allow it (R-CAP-10, R-CAP-11), so a page that
  stops naming an image and its address both follow a switch at once; browsers keep a
  served file for a week, since its name changes whenever its bytes would.

- **R-WEB-17** Should: a breve or an article may quote up to three posts from social
  networks (X, Bluesky, Mastodon, LinkedIn…), each drawn by the site as a quote card after
  the text and before the sources (D21): the words as said, as text in a `<blockquote>`
  citing the original; who said them (name, and handle if any); the platform, read from
  the original's address, and the day it was posted; a link to the original ("Ver en X" /
  "View on X"); and, when they were said in another language, our translation into the
  post's, labelled "Traducción nuestra" / "Our translation". Nothing loads from the
  platform: no avatar, no embed, no script (R-WEB-7). aisafety-media keeps verbatim quotes
  short by its own rule; a page has none.
- **R-WEB-18** Should: a search page in each language, `/buscar?q=` and `/en/search?q=`,
  reached from a magnifier in the header: a plain form that works without JavaScript, and
  the results as the timeline's cards, each with an excerpt where it matched, the matched
  words marked. It searches what the site shows (published breves and articles, never
  pages) with Postgres's full-text search in the language's own rules, so a word's forms
  match ("regulación", "regular"), and a word typed without its accents still finds it.
  The title weighs most, then the summary, then the text; a reader may use quotes for a
  phrase, `OR`, and a minus to leave a word out. Twenty results a page, a link to the
  next. The page is kept out of search engines (`noindex`), and the query is shown as
  text. No outside service, nothing tracked.
- **R-WEB-19** Should: the timelines (the home in either order, a tag's page) go on as the
  reader reads: the next 20 posts load on their own near the end, until 100 have loaded
  that way; then a "Cargar más" / "Load more" button waits, and after it they load on
  their own for 100 more, and so on, so a reader who stops can reach the footer. The
  address keeps how many posts the reader has (`?mostrar=`, `?show=`, at most 300), so a
  reload renders them all and puts the reader back, and back from a post the page fetches
  what it lacks and returns to the same place. A screen reader hears each batch arrive
  ("20 publicaciones más"). Without JavaScript the end of the list is the plain "older
  entries" link to the next page, as before.
- **R-WEB-20** Must: entities (D23) on the site, each in the reader's language:
  - a page for each entity a published story names, `/quien/<id>` and `/en/who/<id>`: its
    name and type ("Persona", "Organización", "Ley"; "Person", "Organisation", "Law"), its
    description, a link to its Wikidata item (`https://www.wikidata.org/wiki/<Q…>`) when it
    has one, and its timeline as a tag's page has it (both orders, R-WEB-13; continuous,
    R-WEB-19). One no published story names answers 404, like a tag with none, and so does
    one the bot hid (R-CAP-12);
  - an index, `/quien` and `/en/who` ("Quién es quién", "Who’s who"), linked from the
    footer, and from the header beside the topics where it has room (on a phone it would
    push the language switch onto a row of its own): people, organisations and laws, each
    group by name, each entity with its description and how many stories name it;
  - a post's page lists its entities ("En esta historia", "In this story"), each a link to
    its page; the timeline's cards don't, to stay light;
  - the sitemap lists both pages with their other language, and so does `hreflang` (an
    entity's only where a story in that language names it); their share card is the
    language's home card (R-WEB-14).

  Their names and descriptions are public text from aisafety-media, never written in the
  site's code. Search (R-WEB-18) doesn't know entities yet: `entity:<id>` and
  `tema:`/`topic:` filters, and finding an entity's page by its names (for which
  aisafety-media would send each entity's aliases), are left for later.

- **R-WEB-21** Should: structured data, as schema.org JSON-LD in the page: a breve is a
  `NewsArticle` and an article an `Article`, `about` its entities; an entity's page is a
  `CollectionPage` whose `mainEntity` is the entity, with its description. Each entity is a
  `Person`, an `Organization` or a `Legislation`, with `sameAs` its Wikidata address when it
  has one. Nothing else on the site emits any.

**Posts API.** Under `/api/v1/` on the API host, with the same bearer token and the
same rules as §9. A post's address is its language and its slug.

| Method and path             | Body                                                                                                                                                                  | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /posts/:lang/:slug`    | `{type, title, summary, body_md, sources[], tags[], entities[], published_at, news_date, author, quotes[], translation_of, unpublished, content_ref: {path, commit}}` | create (`201`) or update (`200`); `type` is `breve`, `article` or `page`; the site's path words are refused; `news_date` is refused on a page; `author`, when a person wrote it, is their name (1–100 characters), and none means AI (D19); `quotes`, at most 3, each `{text (1–280), author (1–100), handle? (≤60), url (http or https), date (YYYY-MM-DD), translation? (≤400)}`, refused on a page (R-WEB-17); `entities`, at most 10 ids, each once, of entities in the registry (D23, R-API-6), refused on a page |
| `DELETE /posts/:lang/:slug` |                                                                                                                                                                       | unpublish: the page returns `410` and drops out of feeds, and so does its other version (D11)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GET /posts`                |                                                                                                                                                                       | list, so aisafety-media can reconcile, with each post's `entities` and `taken_down_at` (R-CAP-11)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PUT /images/:sha256`       | the image's bytes (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), up to 10 MB                                                                                 | store it (`201`) or find it stored (`200`); `400` if the bytes' SHA-256 isn't the address, `415` if it's no image the site takes (R-API-5)                                                                                                                                                                                                                                                                                                                                                                             |
| `GET /images/:sha256`       |                                                                                                                                                                       | its size, its stored sizes and `removed_at` (R-CAP-11), or `404`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GET /images`               |                                                                                                                                                                       | how many images the database records, how many the API's volume has both files of and the first few it lacks (D22): `{store, count, on_disk, missing}`; 503 without the volume                                                                                                                                                                                                                                                                                                                                         |
| `PUT /entities/:id`         | `{type, name, names: {es?, en?}, descriptions: {es, en}, wikidata, content_ref: {path, commit}}`                                                                      | create (`201`) or update (`200`) an entity of the registry (D23): `id` in a tag's shape, at most 60 characters; `type` is `person`, `organisation` or `law`; `name` is the name the site shows and `names` a language's own where it's another (1–200 characters); `descriptions`, one line in each language (1–160); `wikidata`, its item (`Q123`) or `null`. A push brings a deleted entity back, never a hidden one (R-CAP-12)                                                                                      |
| `GET /entities`             |                                                                                                                                                                       | every entity, deleted ones included, with `deleted_at` and `taken_down_at` (R-CAP-12), so aisafety-media can reconcile                                                                                                                                                                                                                                                                                                                                                                                                 |
| `DELETE /entities/:id`      |                                                                                                                                                                       | mark it deleted, so no post can name it; `409` while any post names it, unpublished ones included, listing them (`posts`); `404` if it never was                                                                                                                                                                                                                                                                                                                                                                       |

`lang` is `es` or `en`; `translation_of` is `{lang, slug}` or `null`. A translation whose
original has never been pushed, a second translation in one language and a translation of
a translation are refused with `409`. `unpublished: true` (default `false`) stores the post
already unpublished, for a rebuild; any other push publishes it. Each push is one version;
the public routes show a story once both are published (D11). A push never clears a
takedown (R-CAP-11). `image` is `{sha256, alt, credit, licence, source_url}` or `null`
(refused on a page); a source may carry `preview: {sha256, credit}`. A post may name only
uploaded images: one that isn't is refused with `400`, naming it; and only entities in the
registry: one that isn't, or was deleted, is refused with `400`, naming it.

- **R-API-5** Must: images go up before the post that names them, each at the address of
  the SHA-256 of its own bytes, which the API checks: the same upload twice is one image
  (R-API-3), aisafety-media knows every name before it pushes, and an image the bot
  removed stays removed whoever uploads it again.
- **R-API-6** Must: entities go up before the posts that name them (D23), and stay while
  any post names them: a post names only entities in the registry, and an entity a post
  names can't be deleted. The database holds both (two triggers do a foreign key's work),
  so a push and a deletion at the same moment can't cross; the API checks first, to name
  what's wrong.

**Public read routes** (no token, on no gateway, as `newsroom_public`), each for one
language: `GET /public/posts?lang=` (latest first, no pages, each with its
`source_count`, `news_date`, `author` and, for a translation, its original's
`original_author` for the timeline; `tag`, `entity`, `limit`, and for the next page
the last post's `published_at` and slug as `before` and `before_slug`, since posts can
share an instant; `order=news` lists by news date, its next page led by the last post's
as `before_date`), `GET /public/posts/:lang/:slug` (with `author`, `original_author`
and `quotes`, and the story's other version as `translations`; `404` until both are
published, `410` once either is
unpublished), `GET /public/tags?lang=`, `GET /public/entities?lang=` (every entity a
published story names: `{id, type, name, description, wikidata, posts}`, its name and
description in that language), `GET /public/entities/:id?lang=` (one of them, or `404`),
`GET /public/search?lang=&q=` (R-WEB-18: up to
100 characters in the search engines' syntax; `limit` up to 50 and `cursor`, where the page
starts; `{results, next}`, each result a list entry with its `excerpt` as plain-text
segments, `{text, match}`, and `next` null at the end),
`GET /public/images/:kind/:sha256?size=full|thumb` (`lead` or `preview`; the WebP
while a published post shows it so and the switches allow it, `404` otherwise),
and `GET /public/unpublished`, the addresses the site's proxy answers `410` for. Lists and
posts carry a post's `image` and its sources' previews only while the switches show them,
and its `entities` as `{id, type, name, wikidata}` in its language, without those the bot
hid (R-CAP-12). A `published_at` with no time is midnight in Madrid, the site's clock.

- **R-WEB-8** Must: the site can be rebuilt from aisafety-media (P1) by re-pushing every
  entity in the registry first (R-API-6), then every published post, and every unpublished
  one as unpublished (its address answers `410` again, and its translation can name it),
  originals before their translations; and last, deleting the entities the registry no
  longer has.
- **R-WEB-9** Must: the site stays off in a deployment until gitops gives it its address,
  its name in each language and its author (D12), so it can be merged before they're
  decided.

## 14. Security

- **Secrets:**
  - the bot token, the webhook's secret token, the API token and the database
    credentials are sealed secrets in gitops, generated and sealed by
    `scripts/seal-gitops-secrets.sh`, which never prints them;
  - on the Mac, the API token and the Miniflux token live in the Keychain.
- **Public surface:** the site's pages, `/telegram/webhook` (behind its secret token) and
  `/api/v1` (behind the bearer token, R-API-2). The public read routes and Postgres are
  reachable only inside the cluster.
- **Untrusted input:** captured pages are data, never instructions. They are stored as
  text and rendered nowhere public. The worker reaches only the public internet
  (R-FET-4).
- **Least privilege:** runtime roles own nothing, and `newsroom_public` reads only
  published posts, the images they show and the entities they name, through views.
- **Images** (D17): uploads come only through the token; each is checked against its
  SHA-256, re-encoded to WebP without metadata, raster only (never SVG), with a pixel
  limit before decoding (R-WEB-15). Every pod sets resource requests and limits and a restrictive
  securityContext.
- **CI** never holds cluster credentials (Argo CD pulls), and pull requests from forks
  never run on the self-hosted runner (§15).

## 15. Stack and operations

**Stack.** aiontheballot's ADR-0003, scaled down.

- **Kept:**
  - pnpm 12 and Turbo monorepo, Node 26, TypeScript 7 (strict, ESM) through
    `@slango.configs`; oxlint (type-aware) and Prettier; Vitest; husky and lint-staged;
    Changesets; Renovate with a 3-day minimum release age;
  - latest stable dependencies only, checked on npm when added;
  - Fastify, Kysely with kysely-codegen, zod, dbmate, Postgres 18;
  - Next.js 16 with Panda CSS, and a component library only if an interactive piece
    needs one;
  - Sentry SDKs sending errors only to GlitchTip, with aiontheballot's privacy options
    (no personal data leaves the apps);
  - Readability with jsdom, and pdfjs-dist.
- **Left out:**
  - multi-tenancy and row-level security; audit and immutability triggers; four-eyes
    review;
  - Better Auth and an admin UI;
  - next-intl: the interface's two languages keep their strings in one module;
  - OpenTelemetry, share images, a Playwright suite and mutation tests;
  - a separate fetcher service: the worker fetches, under R-FET-4;
  - ADRs: decisions live in this spec until something changes them.

**Repo layout:**

```text
SPEC.md
README.md
apps/api/            Fastify API (dist/server.js) and worker (dist/worker.js), helm-chart/
apps/web/            public site (Next.js), helm-chart/
packages/db/         Kysely, generated types, connection pools
packages/domain/     pure logic: URL normalisation, Telegram entities, states
db/migrations/*.sql  dbmate; db/schema.sql is generated
helm-charts/aisafety-newsroom/   umbrella chart: api, worker, web, migration Job
scripts/             seal-gitops-secrets.sh
docs/runbooks/
```

**Tests:**

- unit (Vitest): URL normalisation and entity extraction, state transitions, the fetch
  address checks, Markdown sanitising;
- database (Vitest against Postgres 18 in CI): the state machine, the idempotency of
  every write, and the roles (`newsroom_public` can neither write nor read the inbox);
- every new invariant gets its test first.

**Deployment:**

- Images are `<registry>/aisafety-newsroom/<component>:<version>.<sha>`, the registry
  set by the runner and gitops, never `:latest`, with base images pinned by digest.
- CI is GitHub Actions, with actions pinned by SHA:
  - every CI job runs on GitHub-hosted runners, whoever opened the pull request;
  - there are no `pull_request_target` workflows;
  - releases are started by hand on `main` (`gh workflow run release.yml`) once CI has
    passed there. The release finds the newest commit CI passed on, versions it, builds
    and pushes the images on the self-hosted runner, and writes their tags into the
    umbrella chart's `values.yaml`;
  - the self-hosted runner refuses every job its owner didn't start by hand from
    `main`'s workflows (its job-started hook, set in gitops): pushes, pull requests,
    forks and Renovate never run on it.
- Argo CD syncs the secrets first, then the migration Job (a Sync hook), then everything
  else. Migrations are expand/contract, since old pods serve until the rollout ends.
- Pods have a `/healthz` with no dependencies. The API and web run 2 replicas; the
  worker runs 1, replaced by recreating it.

**gitops changes** (in the private gitops repo):

- the Argo CD application, and its values: hosts, routes, the registry;
- the sealed secrets, the registry's pull secret and the default ServiceAccount patch;
- the `newsroom` database, with `newsroom_app` and `newsroom_public` as extra roles, and
  its secret;
- the repo and namespace in the Argo CD project;
- a registry project with pull and push robots;
- the release runner for the repo, with its job-started hook.

**Monitoring:**

- the API, the worker and the web report errors to GlitchTip;
- the worker also reports items that have sat in `queued` for more than 1 h.

**Backups** of the database are gitops' concern. Restoring one loses the inbox items
captured since; posts are rebuilt by re-pushing (P1).

**Runbooks** (`docs/runbooks/`): rotating the bot token and webhook secret, rotating the
API token, re-pushing every post, restoring the database.

## 16. Acceptance criteria

- **AC-1** A link shared to the bot gets "Saved #n" within 5 s while the Mac is off.
  Within 2 min the item is `ready` and the reply shows the page title.
- **AC-2** Sending the same link again (with tracking parameters) creates no new item
  and appends the note.
- **AC-3** A link to x.com is skipped for fetching and still reaches `/news` with its
  note.
- **AC-4** `/news` with no arguments logs every `ready` item in English as its own item
  file, with tags from the watchlist and `newsroom: <id>`, and marks each one `logged`.
- **AC-5** A page whose text tells the reader to do something is stored as text and has
  no other effect. A link to a private address (`localhost`, `10.0.0.1`, or a name that
  resolves to one) is refused and fetches nothing.
- **AC-6** The inbox and posts API refuse any request without the right token. A webhook
  request without the secret token is refused. The public read routes can't be reached
  from outside the cluster.
- **AC-7** A breve approved in aisafety-media appears on the site within 60 s of `/post`.
  Within 60 s of unpublishing, it returns `410` and is gone from the feed.
- **AC-8** `/sweep` with Miniflux configured logs feed items without the researcher
  agent searching for them again.
- **AC-9** Sending an already logged link again with a note creates a follow-up, and the
  next `/news` adds the note to the original's item file ("Added (Dani):").
- **AC-10** `/discard` of the wrong id shows that item's title, and `/restore` brings it
  back to where it was.
- **AC-11** `/` is the Spanish home whatever the browser asks for, `/es/<slug>` answers
  `301` to `/<slug>`, and `/en` is the English home. A
  Spanish breve shows on neither side until its English translation is pushed too; then
  each links to the other, and unpublishing one takes both down (`410`).
- **AC-12** An entity pushed and named by a published story has a page in both languages,
  listed in the index, with the story in its timeline, and the story's page links to it.
  Hidden by the bot, or named by no published story, its page answers 404 and no post
  names it.

## 17. Milestones

| M   | Delivers                                                                                                                    | Depends on |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| M0  | Monorepo, CI and chart; the gitops changes (runner, registry, database, secrets, Argo CD); an empty API and worker deployed | —          |
| M1  | BOT, DB, WRK, inbox API, `tools/newsroom.py`, `/news` queue mode                                                            | M0         |
| M2  | Decide on drafting with a local model from M1's use; build it only if it's worth it                                         | Q4         |
| M3  | Miniflux category and feeds; `/sweep` reads them                                                                            | Q8         |
| M4  | Site with breves in Spanish and English: posts API, pages, feeds; `/breve`, `/post`                                         | —          |
| M5  | Articles                                                                                                                    | Q7         |
