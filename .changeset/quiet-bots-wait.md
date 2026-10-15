---
'@aisafety-newsroom/api': patch
---

The bot waits out Telegram's 429s (`retry_after`) instead of failing, so both replicas can set the webhook as they
start; the worker clears the page text of items logged or discarded 90 days ago (SPEC Q9,
`worker.pageTextRetentionDays`)
