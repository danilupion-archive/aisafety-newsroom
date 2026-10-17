---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/web': minor
'@aisafety-newsroom/domain': minor
---

Search (R-WEB-18): `GET /public/search?lang=&q=` searches published breves and articles with Postgres's full-text
search in each language's rules (accents optional, title over summary over text) and returns each result with a marked
excerpt; the site's `/buscar` and `/en/search` pages show them as the timeline's cards, reached from a magnifier in the
header. `buscar` and `search` are reserved slugs. The timelines go on as the reader reads (R-WEB-19): 20 at a time on
their own, a "Cargar más" after every 100, the address keeping how far the reader got so a reload or the way back
returns to the same place; without JavaScript, the older-entries link as before. The footer is two parts: the name and
the credit as a sentence, and the links beside it.
