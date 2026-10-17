# @aisafety-newsroom/api

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
