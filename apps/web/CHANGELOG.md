# @aisafety-newsroom/web

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
