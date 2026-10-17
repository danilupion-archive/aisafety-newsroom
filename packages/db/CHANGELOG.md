# @aisafety-newsroom/db

## 0.2.1

### Patch Changes

- 6c75259: The apps' database connections run without JIT, which compiled the published-posts view on every read (about 200 ms of
  the database's CPU each) and stalled the site under a little traffic. Statements are bounded (15 s, 5 s for the site's
  reads), a request waits at most 5 s for a connection, and the site's reads of the API give up after 8 s.

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
