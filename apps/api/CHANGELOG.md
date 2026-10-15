# @aisafety-newsroom/api

## 0.1.0

### Minor Changes

- c7f4eef: The fetch worker (SPEC §8): claims queued items, fetches them on the public internet only, extracts their text and
  metadata, retries with backoff, edits the bot's reply; its Deployment and NetworkPolicy in the chart, off by default
- 58377cb: The inbox API (SPEC §9): list, show, logged, discarded, restored and note, behind the bearer token; timestamped notes
- 3254bca: The Telegram bot (SPEC §6): capture of links and notes, duplicates and follow-ups, /pending, /discard, /restore,
  /note and /help, behind the webhook's secret token; its settings in the chart

### Patch Changes

- 8675cb3: `logged` takes aisafety-media's per-item news files (news/YYYY/MM/YYYY-MM-DD-slug.md, SPEC D9), and month files too
- Updated dependencies [58377cb]
  - @aisafety-newsroom/domain@0.1.0
  - @aisafety-newsroom/db@0.0.0
