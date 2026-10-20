---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/migrations': minor
'@aisafety-newsroom/web': minor
'@aisafety-newsroom/domain': minor
---

Entities (D23, R-API-6, R-WEB-20): the people, organisations and laws a story is about, beside its topics. The posts
API keeps a copy of aisafety-media's registry (`PUT`, `GET` and `DELETE /api/v1/entities`; a deletion only marks one,
refused while a post names it) and a post's `entities`, at most ten ids from it; triggers hold both rules in the
database. The site has a page for each entity a published story names, `/quien/<id>` and `/en/who/<id>`, with its
description, its Wikidata link and its timeline in both orders, and an index, `/quien` and `/en/who`, grouped into
people, organisations and laws; a post's page links its entities ("En esta historia"). Both are in the sitemap with
`hreflang`. Posts and entity pages carry schema.org JSON-LD (R-WEB-21). The bot hides an entity's page with
`/takedown entity <id>` and brings it back with `/restore entity <id>` (R-CAP-12). `quien` and `who` are reserved
slugs.
