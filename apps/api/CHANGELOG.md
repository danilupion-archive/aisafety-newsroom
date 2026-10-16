# @aisafety-newsroom/api

## 0.2.0

### Minor Changes

- b2d03f7: Error tracking (SPEC §15): the API, the worker and the site's server report to GlitchTip through the Sentry SDK, errors
  only, with aiontheballot's privacy options; off until gitops gives each its DSN
- f26e12b: Posts for the public site (SPEC §13): the posts table and its public views, the posts API (PUT, DELETE, GET) with a
  breve's 80–150 words and 1–3 sources, the site's reads as newsroom_public, and safe Markdown rendering

### Patch Changes

- f8c7611: The API's NetworkPolicy (SPEC §5): only the gateways and the site's pods reach it; off until gitops names the gateways
- 9384515: Fixes from the first deploy and a review of the live code: the token guard reads the path as the router does (an
  encoded `/%61pi/…` reached the inbox without the token from inside the cluster); a page that crashes the worker is
  given up on after three attempts instead of looping, and items are claimed one at a time; links sent without a scheme
  are fetched; overlong links stay in the note; the "Saved #n" reply is edited even when it was remembered after the
  claim; the charset the server sends is honoured; `/note` on a logged item makes a follow-up; a repeated `/discard`
  keeps its reason; the bot waits out Telegram's 429s; the worker clears the page text of items logged or discarded 90
  days ago (SPEC Q9)
- Updated dependencies [b2d03f7]
- Updated dependencies [f26e12b]
  - @aisafety-newsroom/observability@0.1.0
  - @aisafety-newsroom/db@0.1.0
  - @aisafety-newsroom/domain@0.2.0

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
