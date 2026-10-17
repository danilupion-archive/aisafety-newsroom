---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/migrations': minor
---

`POST /api/v1/notify`: aisafety-media's message to Dani through the bot, as plain text with link previews off, to
Dani's private chat. At most 30 an hour across replicas, counted in the new `app.notifications` under a lock; 400 for
an empty text or one over 4,000 characters, 503 without the bot, 502 when Telegram refuses. The text is never logged.
