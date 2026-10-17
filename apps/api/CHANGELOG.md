# @aisafety-newsroom/api

## 0.14.0

### Minor Changes

- 546856b: Images live only on the API's volume (D22, step 2a): uploads write the two WebP files and a row with their sizes, never
  the bytes; serving reads only the file, and a missing one is a 404 logged by its SHA-256 (the same upload writes it
  again). Without IMAGES_DIR the image routes answer 503. The byte columns are optional and the public view no longer
  reads them; step 2b drops them. The start-up backfill is gone.

## 0.13.0

### Minor Changes

- 800ff8d: Images' files on a volume (D22, step 1): with IMAGES_DIR set (the chart's `imageStore`), uploads also write each
  image's two WebP files there, the site's image route serves the file once the database allows the image (healing a
  missing one from the database), the API copies in at start every image the volume lacks, and `GET /api/v1/images`
  counts what the volume holds. The database keeps the bytes too until step 2. Off by default.

## 0.12.0

### Minor Changes

- 7fa3eda: Search (R-WEB-18): `GET /public/search?lang=&q=` searches published breves and articles with Postgres's full-text
  search in each language's rules (accents optional, title over summary over text) and returns each result with a marked
  excerpt; the site's `/buscar` and `/en/search` pages show them as the timeline's cards, reached from a magnifier in the
  header. `buscar` and `search` are reserved slugs. The timelines go on as the reader reads (R-WEB-19): 20 at a time on
  their own, a "Cargar más" after every 100, the address keeping how far the reader got so a reload or the way back
  returns to the same place; without JavaScript, the older-entries link as before. The footer is two parts: the name and
  the credit as a sentence, and the links beside it.

### Patch Changes

- Updated dependencies [7fa3eda]
  - @aisafety-newsroom/domain@0.8.0
  - @aisafety-newsroom/db@0.2.1

## 0.11.0

### Minor Changes

- a98fdf2: Quote cards (R-WEB-17, D21): a breve or an article may carry up to three quotations from social network posts
  (`quotes`: text, author, handle, url, date, translation), which its page draws as cards after the text: the words, who
  said them, the platform and day, a link to the original, and our translation when needed. Nothing loads from the
  platform. A page takes none.

## 0.10.0

### Minor Changes

- 4e2b675: `POST /api/v1/notify`: aisafety-media's message to Dani through the bot, as plain text with link previews off, to
  Dani's private chat. At most 30 an hour across replicas, counted in the new `app.notifications` under a lock; 400 for
  an empty text or one over 4,000 characters, 503 without the bot, 502 when Telegram refuses. The text is never logged.

## 0.9.0

### Minor Changes

- bdf0a80: Posts may name the person who wrote them (`author`): the site shows "Escrito por <name>" as a badge on the card and in
  the post's line under its tag, with no AI note, and an AI translation of a signed text says so. AI-written stays the
  default, disclosed in the footer ("…, salvo los firmados"), above each AI post's sources and in each feed entry. The
  topic `self-improvement` gets its names, "automejora recursiva" and "recursive self-improvement". The worker's edited
  reply keeps "· log only" for an item Dani wants logged only.

## 0.8.1

### Patch Changes

- 496ccaf: A card shows a story's YouTube video, when one of its sources has a still, before an earlier source's image, so it
  plays from the timeline. The sources list drops its numbers: one row per source, its title as the link, a muted line
  with the day it was consulted and the image's credit, the picture on its right.

## 0.8.0

### Minor Changes

- c6eb7a3: Each inbox item says what Dani wants from it (D18): `intent` is `post` (the default) or `log`. The bot's
  `/log <link> [note]` saves a link to log only, and makes an existing one log only; `/log <id>` and `/post <id>` switch
  an item, naming it, refusing a discarded one and warning on a logged one; `/pending` marks "· log only". `GET /items`
  and `GET /items/:id` return `intent`.

### Patch Changes

- Updated dependencies [c6eb7a3]
  - @aisafety-newsroom/domain@0.7.0
  - @aisafety-newsroom/db@0.2.1

## 0.7.1

### Patch Changes

- c66a1c1: YouTube videos play on the timeline card and at the top of the post, loaded only when the reader presses play: until
  then the site's own still and a play button, then YouTube's privacy-enhanced player in its place, across the card. The
  site's policy lets only that host into a frame. Card pictures are 16:9, across the card on a phone and beside the text
  on a wider screen, with the summary beside them; in the sources list the preview sits on the right, 16:9, so the
  number lines up with the title.

## 0.7.0

### Minor Changes

- 75fb0ec: A card without a lead image shows its first source's preview, credited to the outlet (the public list now carries it).
  The site keeps each API answer for 30 s, never older, and identical reads at once share one request; the proxy's
  checks on a post merge the same way. A followed link shows a thin bar across the top until its page arrives.

## 0.6.1

### Patch Changes

- 6c75259: The apps' database connections run without JIT, which compiled the published-posts view on every read (about 200 ms of
  the database's CPU each) and stalled the site under a little traffic. Statements are bounded (15 s, 5 s for the site's
  reads), a request waits at most 5 s for a connection, and the site's reads of the API give up after 8 s.
- Updated dependencies [6c75259]
  - @aisafety-newsroom/db@0.2.1

## 0.6.0

### Minor Changes

- 526ef4c: Images (D17): every page has the site's own share card; a post may have a licensed lead image and its sources their
  outlets' previews, uploaded by SHA-256 (`PUT /api/v1/images/:sha256`), re-encoded to WebP without metadata and served
  from the site's host under `/img/`. The bot's emergency switches: `/images on|licensed|off`, `/takedown <post>`,
  `/takedown image <post> [lead|<n>]` and their `/restore`, which the public views follow on the next request. `img` and
  `og` are reserved slugs.
  The footer's about link reads "Sobre <site>" / "About <site>", and its items stack on a phone.

### Patch Changes

- Updated dependencies [526ef4c]
  - @aisafety-newsroom/domain@0.6.0
  - @aisafety-newsroom/db@0.2.0

## 0.5.0

### Minor Changes

- 0dbb331: News dates (R-WEB-13, D16): a breve or an article carries the day its story happened (`news_date`; a push without one
  is dated by its posted day), both versions of a story the same, or the site shows neither. The public list takes
  `order=news` (paged by `before_date`), and the site's timelines get a second order, "Por fecha de la noticia" / "By news
  date", the default staying as posted; a card and a post's page say when the story happened on another day. The inbox
  lists by the day each page says it was published with `sort=source` (R-API-4).

## 0.4.0

### Minor Changes

- ef0e8be: YouTube links are read as videos (R-FET-7): every form of a link to one video is recognised as one item, and the worker
  records its channel, full description, length and date from the watch page, or its title and channel from oEmbed when
  the page has no player data. Items say what kind of thing was fetched (`page_kind`), and the bot's reply gives a video's
  length and channel.

### Patch Changes

- Updated dependencies [ef0e8be]
  - @aisafety-newsroom/domain@0.5.0
  - @aisafety-newsroom/db@0.2.0

## 0.3.3

### Patch Changes

- c53a62f: Spanish is at the site's root and English under `/en` (SPEC D10, AC-11): `/` is the Spanish home for every reader,
  whatever the browser asks for, and a Spanish post is `/<slug>`. `/es` and every address under it answer 301 to the
  same address without the prefix. Every link, canonical and `hreflang` address, the sitemap and the Spanish feed
  (`/feed.xml`) follow. The posts API also refuses `en`, `es` and `healthz` as slugs, which share the root with Spanish
  posts.
- Updated dependencies [c53a62f]
  - @aisafety-newsroom/domain@0.4.0
  - @aisafety-newsroom/db@0.2.0

## 0.3.2

### Patch Changes

- e287bac: The site in PandorIA's night design: navy and orange, Hanken Grotesk served by the site itself, the box mark in the
  header and the browser tab, and the wordmark with its IA in orange. The home and tag pages are a timeline (the date,
  a dot on the rail, each post's card with its tags, type and source count); a post shows its sources in their own box
  and links its translation as a button. The header links to the same page in the other language. The API's public list
  says how many sources each post has (`source_count`).
- 9e21280: The worker skips axios.com, like x.com: its bot protection refuses every automated read, so the bot now says straight
  away that the link is saved and not fetched, instead of failing with a 403.

## 0.3.1

### Patch Changes

- b8cc1c8: No infrastructure named in the code, the charts or their comments: the repo is public. Releases start by hand and build
  on a runner that refuses everything else.
- Updated dependencies [b8cc1c8]
  - @aisafety-newsroom/observability@0.1.1

## 0.3.0

### Minor Changes

- 407c670: The site in Spanish and English (SPEC D10, D11, R-WEB-10): every post is published in both, one version translating the
  other, which the database keeps to one original per story and shows only once both versions are published (taking either
  down takes both down); the posts API takes `/posts/:lang/:slug` and `translation_of`, with an English breve's 65–130
  words, and `unpublished`, so a rebuild restores unpublished posts as unpublished; the site serves `/es/…` and `/en/…`
  with each language's path words, labels, dates, tag names and feed, links each post to its translation (hreflang), and
  sends `/` to the reader's language. The site's name is configured per language (`site.name.es`, `site.name.en`)

### Patch Changes

- Updated dependencies [407c670]
  - @aisafety-newsroom/db@0.2.0
  - @aisafety-newsroom/domain@0.3.0

## 0.2.0

### Minor Changes

- b2d03f7: Error tracking (SPEC §15): the API, the worker and the site's server report to GlitchTip through the Sentry SDK, errors
  only, with aiontheballot's privacy options; off until gitops gives each its DSN
- f26e12b: Posts for the public site (SPEC §13): the posts table and its public views, the posts API (PUT, DELETE, GET) with a
  breve's 80–150 words and 1–3 sources, the site's reads as newsroom_public, and safe Markdown rendering

### Patch Changes

- f8c7611: The API's NetworkPolicy (SPEC §5): only the gateways and the site's pods reach it; off until gitops names the gateways
- 9384515: Fixes from the first deploy and a review of the live code: the token guard reads the path as the router does (an
  encoded `/%61pi/…` reached the inbox without the token from inside the cluster); a page that crashes the worker is
  given up on after three attempts instead of looping, and items are claimed one at a time; links sent without a scheme
  are fetched; overlong links stay in the note; the "Saved #n" reply is edited even when it was remembered after the
  claim; the charset the server sends is honoured; `/note` on a logged item makes a follow-up; a repeated `/discard`
  keeps its reason; the bot waits out Telegram's 429s; the worker clears the page text of items logged or discarded 90
  days ago (SPEC Q9)
- Updated dependencies [b2d03f7]
- Updated dependencies [f26e12b]
  - @aisafety-newsroom/observability@0.1.0
  - @aisafety-newsroom/db@0.1.0
  - @aisafety-newsroom/domain@0.2.0

## 0.1.0

### Minor Changes

- c7f4eef: The fetch worker (SPEC §8): claims queued items, fetches them on the public internet only, extracts their text and
  metadata, retries with backoff, edits the bot's reply; its Deployment and NetworkPolicy in the chart, off by default
- 58377cb: The inbox API (SPEC §9): list, show, logged, discarded, restored and note, behind the bearer token; timestamped notes
- 3254bca: The Telegram bot (SPEC §6): capture of links and notes, duplicates and follow-ups, /pending, /discard, /restore,
  /note and /help, behind the webhook's secret token; its settings in the chart

### Patch Changes

- 8675cb3: `logged` takes aisafety-media's per-item news files (news/YYYY/MM/YYYY-MM-DD-slug.md, SPEC D9), and month files too
- Updated dependencies [58377cb]
  - @aisafety-newsroom/domain@0.1.0
  - @aisafety-newsroom/db@0.0.0
