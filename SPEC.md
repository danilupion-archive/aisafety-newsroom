# aisafety-newsroom · Specification

Status: **draft v0.4** · 2026-10-16 · Owner: Dani

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
co-leads Pausemos la IA (PauseAI Spain), but the site doesn't speak for the organisation
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
Readers ─▶ [public] <site>/es, /en ─▶ web ─▶ api public read routes ─┘
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
`/api/v1/*` are routed; the site's `<site>` is `pandoria.es`, whose addresses all start
with a language, `/es/` or `/en/` (`www.pandoria.es` redirects there). The site reads the
API inside the cluster, so it never calls the API's host.

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
  - drop tracking parameters: `utm_*`, `fbclid`, `gclid`, `igshid`, `ref`, and `s` and
    `t` on x.com;
  - treat `twitter.com` as `x.com`;
  - drop the trailing slash.
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
  - `/pending`: up to 20 unlogged items, with id, status, and title or host;
  - `/discard <id> [reason]`, which replies with the item's title or host, so a wrong
    id is noticed at once;
  - `/restore <id>`: brings a discarded item back (R-DB-1);
  - `/note <id> <text>`;
  - `/help`.
- **R-CAP-9** Should: record `submitted_by` (the Telegram user id) on each item, ready
  for more contributors later `[Q6]`.

## 7. Inbox store (DB)

A `newsroom` database on the shared Postgres. Migrations live in `db/migrations/`: plain
SQL, run by dbmate, forward-only, one concern each. `db/schema.sql` is the generated dump
and is reviewed in every PR.

**Roles.** None of the runtime roles own anything:

- `newsroom_owner` owns the tables and is used only by the migration Job;
- `newsroom_app` is used by the API and the worker;
- `newsroom_public` is used by the API's public read routes, and may only read published
  posts.

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
| `fetch_status`                                      | enum                        | `pending`, `ok`, `failed`, `skipped`                                |
| `fetch_attempts`, `next_fetch_at`                   | int, timestamptz            | retries with backoff                                                |
| `http_status`, `final_url`, `content_type`          | int, text, text             |                                                                     |
| `page_title`, `page_site_name`, `page_published_at` | text                        | from page metadata, verbatim                                        |
| `page_text`                                         | text                        | extracted main text, ≤ 20,000 chars; cleared after 90 days `[Q9]`   |
| `fetched_at`, `logged_at`                           | timestamptz                 |                                                                     |
| `logged_ref`                                        | jsonb                       | `{news_file, entry_date, tags, relevance}` from aisafety-media      |
| `discard_reason`, `last_error`                      | text                        |                                                                     |
| `reply_chat_id`, `reply_message_id`                 | bigint                      | the "Saved #n" reply, so it can be edited                           |

`telegram_updates` keeps each processed `update_id` (R-CAP-2).

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

| Method and path             | Body or query                                         | Returns                                                                                                                                      |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /items`                | `status=ready,needs_review` (default), `limit` (≤ 50) | items without `page_text`, with `page_excerpt` (first 4,000 chars); a follow-up also carries its original's id, URL, status and `logged_ref` |
| `GET /items/:id`            |                                                       | the full item, including `page_text`                                                                                                         |
| `POST /items/:id/logged`    | `{news_file, entry_date, tags, relevance}`            | `200` with the item                                                                                                                          |
| `POST /items/:id/discarded` | `{reason}`                                            | `200` with the item                                                                                                                          |
| `POST /items/:id/restored`  |                                                       | `200` with the item                                                                                                                          |
| `POST /items/:id/note`      | `{text}`                                              | `200` with the item                                                                                                                          |

Errors are `{ "error": "message" }` with `400`, `401`, `404` or `409`.

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

  It uses no agents. The reply is one line per item.

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

## 11. Open questions

| #   | Question                                                                     | Leaning                                                                                                |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Q4  | Is drafting with a local model worth building? (§8.2)                        | Decide after using M1                                                                                  |
| Q6  | Will others send items later?                                                | Designed for, not built                                                                                |
| Q7  | Articles in v1, or breves first?                                             | Breves first                                                                                           |
| Q8  | Which "Where to look" sources have usable feeds?                             | Checked: the watchlist's Feeds (2026-10-15)                                                            |
| Q9  | How long to keep `page_text` (size, copyright)?                              | Clear it 90 days after `logged` or `discarded`                                                         |
| Q10 | Licence for the site's content (breves, articles)                            | CC BY 4.0, like aiontheballot's content                                                                |
| Q12 | An English breve's length (R-WEB-1)                                          | 65–130 words: Spanish's 80–150, about 15% less                                                         |
| Q13 | Images from the news on posts: which may be used, how credited, stored where | Optional per post, with source and credit; a copy the site serves, never a hotlink; none until decided |

### Decided (v0.2–v0.4)

| #   | Decision                                                                                                                           | Was          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| D1  | The bot, API, worker and database run on Dani's Kubernetes cluster; n8n isn't part of the system                                   | Q2, Q3       |
| D2  | The inbox lives in a `newsroom` database on the shared Postgres                                                                    | Q2           |
| D3  | The site is Next.js, rendered on the server from the API; no rebuild per post                                                      | Q5           |
| D4  | The site is Dani's own; the about page mentions co-leading Pausemos la IA; no review by the organisation                           | Q1 (in part) |
| D5  | Drafting with a local model waits until M1 has been used                                                                           | Q4           |
| D6  | The repo is `github.com/danilupion/aisafety-newsroom`, public, AGPL-3.0-or-later                                                   | —            |
| D7  | The inbox and posts API are on a public host behind a bearer token, not on a private network                                       | —            |
| D8  | The API's host is `newsroom.danilupion.com`, under `/api/v1` and `/telegram/webhook`                                               | Q1 (in part) |
| D9  | The news log is one file per item; `news_file` is `news/YYYY/MM/YYYY-MM-DD-slug.md`, not a month file                              | —            |
| D10 | The site is in Spanish and English from v1, both on one host under `/es/` and `/en/`                                               | Q1 (in part) |
| D11 | Every post is published in both languages; the site shows a story only when both versions are                                      | Q11          |
| D12 | The site is PandorIA, at `pandoria.es`, the same name in both languages; its look is the night design with the box mark (R-WEB-11) | Q1           |

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
  - **breve**: a title, 1–3 sources, 80–150 words in Spanish or 65–130 in English, which
    says the same in fewer words `[Q12]`;
  - **article**: long form.

  Each lists its sources (title, link, access date) and its tags.

- **R-WEB-2** Must: content comes only from aisafety-media through the posts API.
  Nothing from the inbox reaches the site (P2, P3).
- **R-WEB-3** Must: no AI-generated images; non-partisan; honest about uncertainty.
  Every page says who writes it (Dani) and links to the about page, which says who Dani
  is. The site doesn't speak for Pausemos la IA.
- **R-WEB-10** Must: every post is published in Spanish and English (D11): written in
  one language and translated into the other. A translation names its original, which
  has been pushed already; a story is one original and its translation, never a
  translation of a translation (the database enforces it). The site shows a story only
  when both versions are published, so no reader finds one language alone, not even
  between the two pushes; taking either version down takes both down (`410`). Each
  version links to the other, visibly and for search engines (`hreflang`).

**Pages,** in each language under its prefix (D10), with its own words:

| Page                       | Spanish              | English         |
| -------------------------- | -------------------- | --------------- |
| Latest items, page by page | `/es`                | `/en`           |
| One item                   | `/es/<slug>`         | `/en/<slug>`    |
| A tag's items (named tags) | `/es/etiqueta/<tag>` | `/en/tag/<tag>` |
| Topics index               | `/es/temas`          | `/en/topics`    |
| About                      | `/es/sobre`          | `/en/about`     |
| Atom feed                  | `/es/feed.xml`       | `/en/feed.xml`  |

`/` sends readers to the language their browser asks for, Spanish if neither; the sitemap
lists both. An address outside both languages answers 404 in both. The about page's text
is a post of type `page` whose slug is its language's word (`sobre`, `about`), pushed from
aisafety-media like the rest (R-WEB-2): pages are never listed, need no sources, and
nothing on the site is written in its code. The six path words are refused as slugs in
both languages, so no post hides behind a page.

- **R-WEB-4** Must: a Spanish and an English interface, each language's own labels,
  dates and tag names, and a link to the other language labelled in that language; Open
  Graph and canonical metadata; usable at phone width; accessible (semantic HTML,
  `lang` on every page, contrast, alt text; WCAG 2.2 AA as the target).
- **R-WEB-11** Should: the look of D12. One dark theme: navy `#0F172A`, cards `#1E293B`,
  the accent `#FF9416` on navy only. One typeface, Hanken Grotesk, served by the site
  itself. The mark, a box with its lid ajar and light escaping, in the header, as the
  site's icon and as the bot's avatar; the name with its trailing "IA" in the accent;
  taglines "Los riesgos de la IA, día a día" and "AI risk, day by day". From PauseAI only
  the two colours, never its typeface or its marks: the site is Dani's own (D4).
- **R-WEB-5** Must: Markdown is rendered to sanitised HTML. No raw HTML from posts.
- **R-WEB-6** Must: the web app reads posts from the API's public read routes inside the
  cluster, which use `newsroom_public` (P7). It caches each answer for at most 60 s.
- **R-WEB-7** Should: Plausible for analytics and nothing else (no cookie banner
  needed); GlitchTip for server-side errors. No error SDK in the browser in v1.

**Posts API.** Under `/api/v1/` on the API host, with the same bearer token and the
same rules as §9. A post's address is its language and its slug.

| Method and path             | Body                                                                                                                         | Effect                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `PUT /posts/:lang/:slug`    | `{type, title, summary, body_md, sources[], tags[], published_at, translation_of, unpublished, content_ref: {path, commit}}` | create (`201`) or update (`200`); `type` is `breve`, `article` or `page`; the site's path words are refused |
| `DELETE /posts/:lang/:slug` |                                                                                                                              | unpublish: the page returns `410` and drops out of feeds, and so does its other version (D11)               |
| `GET /posts`                |                                                                                                                              | list, so aisafety-media can reconcile                                                                       |

`lang` is `es` or `en`; `translation_of` is `{lang, slug}` or `null`. A translation whose
original has never been pushed, a second translation in one language and a translation of
a translation are refused with `409`. `unpublished: true` (default `false`) stores the post
already unpublished, for a rebuild; any other push publishes it. Each push is one version;
the public routes show a story once both are published (D11).

**Public read routes** (no token, on no gateway, as `newsroom_public`), each for one
language: `GET /public/posts?lang=` (latest first, no pages, each with its
`source_count` for the timeline; `tag`, `limit`, and for the next page the last post's
`published_at` and slug as `before` and `before_slug`, since posts can share an
instant), `GET /public/posts/:lang/:slug` (with the story's other
version as `translations`; `404` until both are published, `410` once either is
unpublished), `GET /public/tags?lang=`,
and `GET /public/unpublished`, the addresses the site's proxy answers `410` for. A
`published_at` with no time is midnight in Madrid, the site's clock.

- **R-WEB-8** Must: the site can be rebuilt from aisafety-media (P1) by re-pushing every
  published post, and every unpublished one as unpublished (its address answers `410`
  again, and its translation can name it), originals before their translations.
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
  published posts. Every pod sets resource requests and limits and a restrictive
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
- **AC-11** `/` sends a browser that asks for English to `/en` and any other to `/es`. A
  Spanish breve shows on neither side until its English translation is pushed too; then
  each links to the other, and unpublishing one takes both down (`410`).

## 17. Milestones

| M   | Delivers                                                                                                                    | Depends on |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| M0  | Monorepo, CI and chart; the gitops changes (runner, registry, database, secrets, Argo CD); an empty API and worker deployed | —          |
| M1  | BOT, DB, WRK, inbox API, `tools/newsroom.py`, `/news` queue mode                                                            | M0         |
| M2  | Decide on drafting with a local model from M1's use; build it only if it's worth it                                         | Q4         |
| M3  | Miniflux category and feeds; `/sweep` reads them                                                                            | Q8         |
| M4  | Site with breves in Spanish and English: posts API, pages, feeds; `/breve`, `/post`                                         | —          |
| M5  | Articles                                                                                                                    | Q7         |
