# @aisafety-newsroom/migrations

## 0.12.0

### Minor Changes

- 983dea8: Entities (D23, R-API-6, R-WEB-20): the people, organisations and laws a story is about, beside its topics. The posts
  API keeps a copy of aisafety-media's registry (`PUT`, `GET` and `DELETE /api/v1/entities`; a deletion only marks one,
  refused while a post names it) and a post's `entities`, at most ten ids from it; triggers hold both rules in the
  database. The site has a page for each entity a published story names, `/quien/<id>` and `/en/who/<id>`, with its
  description, its Wikidata link and its timeline in both orders, and an index, `/quien` and `/en/who`, grouped into
  people, organisations and laws; a post's page links its entities ("En esta historia"). Both are in the sitemap with
  `hreflang`. Posts and entity pages carry schema.org JSON-LD (R-WEB-21). The bot hides an entity's page with
  `/takedown entity <id>` and brings it back with `/restore entity <id>` (R-CAP-12). `quien` and `who` are reserved
  slugs.

### Patch Changes

- ae4d977: Dependencies bump: Node 26.12.0 (images on node:26.12.0-alpine) and pnpm 12.14.0.

## 0.11.0

### Minor Changes

- b64ee2c: Images on a volume, step 2b: the database drops the image byte columns (their sizes required, filled for any row that
  lacked them), and the public image view comes back without them. The API reads the recorded sizes directly.

## 0.10.0

### Minor Changes

- 546856b: Images live only on the API's volume (D22, step 2a): uploads write the two WebP files and a row with their sizes, never
  the bytes; serving reads only the file, and a missing one is a 404 logged by its SHA-256 (the same upload writes it
  again). Without IMAGES_DIR the image routes answer 503. The byte columns are optional and the public view no longer
  reads them; step 2b drops them. The start-up backfill is gone.

## 0.9.0

### Minor Changes

- a98fdf2: Quote cards (R-WEB-17, D21): a breve or an article may carry up to three quotations from social network posts
  (`quotes`: text, author, handle, url, date, translation), which its page draws as cards after the text: the words, who
  said them, the platform and day, a link to the original, and our translation when needed. Nothing loads from the
  platform. A page takes none.

## 0.8.0

### Minor Changes

- 4e2b675: `POST /api/v1/notify`: aisafety-media's message to Dani through the bot, as plain text with link previews off, to
  Dani's private chat. At most 30 an hour across replicas, counted in the new `app.notifications` under a lock; 400 for
  an empty text or one over 4,000 characters, 503 without the bot, 502 when Telegram refuses. The text is never logged.

## 0.7.0

### Minor Changes

- bdf0a80: Posts may name the person who wrote them (`author`): the site shows "Escrito por <name>" as a badge on the card and in
  the post's line under its tag, with no AI note, and an AI translation of a signed text says so. AI-written stays the
  default, disclosed in the footer ("…, salvo los firmados"), above each AI post's sources and in each feed entry. The
  topic `self-improvement` gets its names, "automejora recursiva" and "recursive self-improvement". The worker's edited
  reply keeps "· log only" for an item Dani wants logged only.

## 0.6.0

### Minor Changes

- c6eb7a3: Each inbox item says what Dani wants from it (D18): `intent` is `post` (the default) or `log`. The bot's
  `/log <link> [note]` saves a link to log only, and makes an existing one log only; `/log <id>` and `/post <id>` switch
  an item, naming it, refusing a discarded one and warning on a logged one; `/pending` marks "· log only". `GET /items`
  and `GET /items/:id` return `intent`.

## 0.5.0

### Minor Changes

- 526ef4c: Images (D17): every page has the site's own share card; a post may have a licensed lead image and its sources their
  outlets' previews, uploaded by SHA-256 (`PUT /api/v1/images/:sha256`), re-encoded to WebP without metadata and served
  from the site's host under `/img/`. The bot's emergency switches: `/images on|licensed|off`, `/takedown <post>`,
  `/takedown image <post> [lead|<n>]` and their `/restore`, which the public views follow on the next request. `img` and
  `og` are reserved slugs.
  The footer's about link reads "Sobre <site>" / "About <site>", and its items stack on a phone.

## 0.4.0

### Minor Changes

- 0dbb331: News dates (R-WEB-13, D16): a breve or an article carries the day its story happened (`news_date`; a push without one
  is dated by its posted day), both versions of a story the same, or the site shows neither. The public list takes
  `order=news` (paged by `before_date`), and the site's timelines get a second order, "Por fecha de la noticia" / "By news
  date", the default staying as posted; a card and a post's page say when the story happened on another day. The inbox
  lists by the day each page says it was published with `sort=source` (R-API-4).

## 0.3.0

### Minor Changes

- ef0e8be: YouTube links are read as videos (R-FET-7): every form of a link to one video is recognised as one item, and the worker
  records its channel, full description, length and date from the watch page, or its title and channel from oEmbed when
  the page has no player data. Items say what kind of thing was fetched (`page_kind`), and the bot's reply gives a video's
  length and channel.

## 0.2.1

### Patch Changes

- b8cc1c8: No infrastructure named in the code, the charts or their comments: the repo is public. Releases start by hand and build
  on a runner that refuses everything else.

## 0.2.0

### Minor Changes

- 407c670: The site in Spanish and English (SPEC D10, D11, R-WEB-10): every post is published in both, one version translating the
  other, which the database keeps to one original per story and shows only once both versions are published (taking either
  down takes both down); the posts API takes `/posts/:lang/:slug` and `translation_of`, with an English breve's 65–130
  words, and `unpublished`, so a rebuild restores unpublished posts as unpublished; the site serves `/es/…` and `/en/…`
  with each language's path words, labels, dates, tag names and feed, links each post to its translation (hreflang), and
  sends `/` to the reader's language. The site's name is configured per language (`site.name.es`, `site.name.en`)

## 0.1.0

### Minor Changes

- f26e12b: Posts for the public site (SPEC §13): the posts table and its public views, the posts API (PUT, DELETE, GET) with a
  breve's 80–150 words and 1–3 sources, the site's reads as newsroom_public, and safe Markdown rendering
