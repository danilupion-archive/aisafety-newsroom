# @aisafety-newsroom/web

## 0.14.1

### Patch Changes

- 2e7f5ae: The header mark is bigger (58 px) and livelier: its tentacles bend in three segments, root to tip, the tips curl, the
  pink light breathes and the lid lifts a hair, gently at rest and markedly more on hover or focus. The box opens on every
  full page load, reloads included, and still not on a move within the site.

## 0.14.0

### Minor Changes

- f96f4a1: The header's mark is alive: on a visit's first page the box opens (a jolt, the lid swinging up as the pink light comes
  on) and the tentacles grow out of it; then they sway very lightly, more widely while the logo is hovered or focused,
  easing in and out. It rests out of view and stays still with prefers-reduced-motion; the icons and cards stay still.

## 0.13.4

### Patch Changes

- 4669fc6: The footer's links look like links, as in posts: brighter than the text around them, underlined in the accent, the accent
  on hover.

## 0.13.3

### Patch Changes

- 34492fb: Timeline cards: the details line becomes the card's footer, set apart by a rule, smaller and dimmer than the summary,
  with an "Escrito con IA" chip and "Leer →" on the right. On wider screens the picture floats right, so the title and a
  long summary run beside it and on under it.

## 0.13.2

### Patch Changes

- 21adf7b: Switching the timeline's order (or topic) without a reload starts a fresh list, instead of keeping the posts loaded in
  the other order.

## 0.13.1

### Patch Changes

- 90eb6fb: On a wide screen the header's magnifier opens a search field in place (Enter shows the results, Escape closes it); on a
  phone, or without JavaScript, it stays a link, and the empty search page puts the cursor in its box.

## 0.13.0

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

## 0.12.0

### Minor Changes

- a98fdf2: Quote cards (R-WEB-17, D21): a breve or an article may carry up to three quotations from social network posts
  (`quotes`: text, author, handle, url, date, translation), which its page draws as cards after the text: the words, who
  said them, the platform and day, a link to the original, and our translation when needed. Nothing loads from the
  platform. A page takes none.

## 0.11.1

### Patch Changes

- 17a4b57: The timeline's order switch says what it orders by ("Ordenar por: Publicación · Fecha de la noticia" / "Sort by:
  Posted · News date"), and hovering the chosen order no longer turns its text light on the aquamarine.

## 0.11.0

### Minor Changes

- a799e11: The new look (R-WEB-11): aquamarine (#7FFFD4) is the accent for links, tags, dates, buttons, switches and focus; hot
  pink (#FF4FD8) marks highlights only, the breves' timeline dots, the video play button and a followed link's bar. The
  mark is Pandora's box with aquamarine tentacles coming out of it and pink light pouring from the gap; the icon is its
  rising tentacle alone, and an apple-icon joins it. The wordmark's "IA" runs from aquamarine to pink. The share cards
  carry the new mark and colours. PauseAI's orange is gone.

## 0.10.0

### Minor Changes

- bdf0a80: Posts may name the person who wrote them (`author`): the site shows "Escrito por <name>" as a badge on the card and in
  the post's line under its tag, with no AI note, and an AI translation of a signed text says so. AI-written stays the
  default, disclosed in the footer ("…, salvo los firmados"), above each AI post's sources and in each feed entry. The
  topic `self-improvement` gets its names, "automejora recursiva" and "recursive self-improvement". The worker's edited
  reply keeps "· log only" for an item Dani wants logged only.

## 0.9.2

### Patch Changes

- 496ccaf: A card shows a story's YouTube video, when one of its sources has a still, before an earlier source's image, so it
  plays from the timeline. The sources list drops its numbers: one row per source, its title as the link, a muted line
  with the day it was consulted and the image's credit, the picture on its right.

## 0.9.1

### Patch Changes

- Updated dependencies [c6eb7a3]
  - @aisafety-newsroom/domain@0.7.0

## 0.9.0

### Minor Changes

- c66a1c1: YouTube videos play on the timeline card and at the top of the post, loaded only when the reader presses play: until
  then the site's own still and a play button, then YouTube's privacy-enhanced player in its place, across the card. The
  site's policy lets only that host into a frame. Card pictures are 16:9, across the card on a phone and beside the text
  on a wider screen, with the summary beside them; in the sources list the preview sits on the right, 16:9, so the
  number lines up with the title.

## 0.8.0

### Minor Changes

- 75fb0ec: A card without a lead image shows its first source's preview, credited to the outlet (the public list now carries it).
  The site keeps each API answer for 30 s, never older, and identical reads at once share one request; the proxy's
  checks on a post merge the same way. A followed link shows a thin bar across the top until its page arrives.

## 0.7.1

### Patch Changes

- 6c75259: The apps' database connections run without JIT, which compiled the published-posts view on every read (about 200 ms of
  the database's CPU each) and stalled the site under a little traffic. Statements are bounded (15 s, 5 s for the site's
  reads), a request waits at most 5 s for a connection, and the site's reads of the API give up after 8 s.

## 0.7.0

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

## 0.6.0

### Minor Changes

- 0dbb331: News dates (R-WEB-13, D16): a breve or an article carries the day its story happened (`news_date`; a push without one
  is dated by its posted day), both versions of a story the same, or the site shows neither. The public list takes
  `order=news` (paged by `before_date`), and the site's timelines get a second order, "Por fecha de la noticia" / "By news
  date", the default staying as posted; a card and a post's page say when the story happened on another day. The inbox
  lists by the day each page says it was published with `sort=source` (R-API-4).

### Patch Changes

- 0dbb331: A missing address answers 404 with the not-found page of its language, inside its layout and with its text in the page
  itself, instead of a shell that only script fills: the proxy tells an address that is no page, a post the API doesn't
  have and a tag no published post carries, and serves `missing.html` with the status.

## 0.5.0

### Minor Changes

- 35ef1da: The site says its texts are written by AI and picked and checked by its editor: in the footer (the name linked when
  `AUTHOR_URL` gives a page), above each post's sources and at the end of each feed entry. The texts' licence, CC BY 4.0,
  in the footer and the feeds. New tagline and intro.

### Patch Changes

- Updated dependencies [ef0e8be]
  - @aisafety-newsroom/domain@0.5.0

## 0.4.0

### Minor Changes

- feba3d5: Plausible through the site's own script (`pa-….js`), started as Plausible's snippet does; the domain setting is gone.
- c53a62f: Spanish is at the site's root and English under `/en` (SPEC D10, AC-11): `/` is the Spanish home for every reader,
  whatever the browser asks for, and a Spanish post is `/<slug>`. `/es` and every address under it answer 301 to the
  same address without the prefix. Every link, canonical and `hreflang` address, the sitemap and the Spanish feed
  (`/feed.xml`) follow. The posts API also refuses `en`, `es` and `healthz` as slugs, which share the root with Spanish
  posts.

### Patch Changes

- Updated dependencies [c53a62f]
  - @aisafety-newsroom/domain@0.4.0

## 0.3.0

### Minor Changes

- e287bac: The site in PandorIA's night design: navy and orange, Hanken Grotesk served by the site itself, the box mark in the
  header and the browser tab, and the wordmark with its IA in orange. The home and tag pages are a timeline (the date,
  a dot on the rail, each post's card with its tags, type and source count); a post shows its sources in their own box
  and links its translation as a button. The header links to the same page in the other language. The API's public list
  says how many sources each post has (`source_count`).

## 0.2.1

### Patch Changes

- b8cc1c8: No infrastructure named in the code, the charts or their comments: the repo is public. Releases start by hand and build
  on a runner that refuses everything else.
- Updated dependencies [b8cc1c8]
  - @aisafety-newsroom/observability@0.1.1

## 0.2.0

### Minor Changes

- 407c670: The site in Spanish and English (SPEC D10, D11, R-WEB-10): every post is published in both, one version translating the
  other, which the database keeps to one original per story and shows only once both versions are published (taking either
  down takes both down); the posts API takes `/posts/:lang/:slug` and `translation_of`, with an English breve's 65–130
  words, and `unpublished`, so a rebuild restores unpublished posts as unpublished; the site serves `/es/…` and `/en/…`
  with each language's path words, labels, dates, tag names and feed, links each post to its translation (hreflang), and
  sends `/` to the reader's language. The site's name is configured per language (`site.name.es`, `site.name.en`)

### Patch Changes

- Updated dependencies [407c670]
  - @aisafety-newsroom/domain@0.3.0

## 0.1.0

### Minor Changes

- b2d03f7: Error tracking (SPEC §15): the API, the worker and the site's server report to GlitchTip through the Sentry SDK, errors
  only, with aiontheballot's privacy options; off until gitops gives each its DSN
- ff0a258: The public Spanish site (SPEC §13): latest posts, a page per post with its sources, tag pages, the about page, an Atom
  feed, a sitemap; unpublished posts answer 410; off until gitops gives it its name, address and author

### Patch Changes

- Updated dependencies [b2d03f7]
- Updated dependencies [f26e12b]
  - @aisafety-newsroom/observability@0.1.0
  - @aisafety-newsroom/domain@0.2.0
