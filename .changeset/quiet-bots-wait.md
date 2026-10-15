---
'@aisafety-newsroom/api': patch
---

Fixes from the first deploy and a review of the live code: the token guard reads the path as the router does (an
encoded `/%61pi/…` reached the inbox without the token from inside the cluster); a page that crashes the worker is
given up on after three attempts instead of looping, and items are claimed one at a time; links sent without a scheme
are fetched; overlong links stay in the note; the "Saved #n" reply is edited even when it was remembered after the
claim; the charset the server sends is honoured; `/note` on a logged item makes a follow-up; a repeated `/discard`
keeps its reason; the bot waits out Telegram's 429s; the worker clears the page text of items logged or discarded 90
days ago (SPEC Q9)
