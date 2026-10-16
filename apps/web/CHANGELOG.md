# @aisafety-newsroom/web

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
