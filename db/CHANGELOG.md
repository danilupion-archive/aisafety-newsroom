# @aisafety-newsroom/migrations

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
