---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/web': minor
'@aisafety-newsroom/migrations': minor
'@aisafety-newsroom/db': minor
'@aisafety-newsroom/domain': minor
---

The site in Spanish and English (SPEC D10, D11, R-WEB-10): every post is published in both, one version translating the
other, which the database keeps to one original per story and shows only once both versions are published (taking either
down takes both down); the posts API takes `/posts/:lang/:slug` and `translation_of`, with an English breve's 65–130
words, and `unpublished`, so a rebuild restores unpublished posts as unpublished; the site serves `/es/…` and `/en/…`
with each language's path words, labels, dates, tag names and feed, links each post to its translation (hreflang), and
sends `/` to the reader's language. The site's name is configured per language (`site.name.es`, `site.name.en`)
