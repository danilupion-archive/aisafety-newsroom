---
'@aisafety-newsroom/api': minor
---

The fetch worker (SPEC §8): claims queued items, fetches them on the public internet only, extracts their text and
metadata, retries with backoff, edits the bot's reply; its Deployment and NetworkPolicy in the chart, off by default
