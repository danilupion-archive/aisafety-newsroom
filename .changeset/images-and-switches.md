---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/migrations': minor
'@aisafety-newsroom/web': minor
'@aisafety-newsroom/domain': minor
---

Images (D17): every page has the site's own share card; a post may have a licensed lead image and its sources their
outlets' previews, uploaded by SHA-256 (`PUT /api/v1/images/:sha256`), re-encoded to WebP without metadata and served
from the site's host under `/img/`. The bot's emergency switches: `/images on|licensed|off`, `/takedown <post>`,
`/takedown image <post> [lead|<n>]` and their `/restore`, which the public views follow on the next request. `img` and
`og` are reserved slugs.
The footer's about link reads "Sobre <site>" / "About <site>", and its items stack on a phone.
