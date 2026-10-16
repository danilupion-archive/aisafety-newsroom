---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/migrations': minor
'@aisafety-newsroom/web': minor
---

News dates (R-WEB-13, D16): a breve or an article carries the day its story happened (`news_date`; a push without one
is dated by its posted day), both versions of a story the same, or the site shows neither. The public list takes
`order=news` (paged by `before_date`), and the site's timelines get a second order, "Por fecha de la noticia" / "By news
date", the default staying as posted; a card and a post's page say when the story happened on another day. The inbox
lists by the day each page says it was published with `sort=source` (R-API-4).
