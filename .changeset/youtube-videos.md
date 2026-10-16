---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/migrations': minor
'@aisafety-newsroom/domain': minor
---

YouTube links are read as videos (R-FET-7): every form of a link to one video is recognised as one item, and the worker
records its channel, full description, length and date from the watch page, or its title and channel from oEmbed when
the page has no player data. Items say what kind of thing was fetched (`page_kind`), and the bot's reply gives a video's
length and channel.
