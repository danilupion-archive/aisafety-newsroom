---
'@aisafety-newsroom/web': patch
---

A missing address answers 404 with the not-found page of its language, inside its layout and with its text in the page
itself, instead of a shell that only script fills: the proxy tells an address that is no page, a post the API doesn't
have and a tag no published post carries, and serves `missing.html` with the status.
