---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/migrations': minor
'@aisafety-newsroom/domain': minor
---

Each inbox item says what Dani wants from it (D18): `intent` is `post` (the default) or `log`. The bot's
`/log <link> [note]` saves a link to log only, and makes an existing one log only; `/log <id>` and `/post <id>` switch
an item, naming it, refusing a discarded one and warning on a logged one; `/pending` marks "· log only". `GET /items`
and `GET /items/:id` return `intent`.
