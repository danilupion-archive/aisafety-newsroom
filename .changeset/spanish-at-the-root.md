---
'@aisafety-newsroom/web': minor
'@aisafety-newsroom/domain': minor
'@aisafety-newsroom/api': patch
---

Spanish is at the site's root and English under `/en` (SPEC D10, AC-11): `/` is the Spanish home for every reader,
whatever the browser asks for, and a Spanish post is `/<slug>`. `/es` and every address under it answer 301 to the
same address without the prefix. Every link, canonical and `hreflang` address, the sitemap and the Spanish feed
(`/feed.xml`) follow. The posts API also refuses `en`, `es` and `healthz` as slugs, which share the root with Spanish
posts.
