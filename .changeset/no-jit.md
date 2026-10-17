---
'@aisafety-newsroom/api': patch
'@aisafety-newsroom/db': patch
'@aisafety-newsroom/web': patch
---

The apps' database connections run without JIT, which compiled the published-posts view on every read (about 200 ms of
the database's CPU each) and stalled the site under a little traffic. Statements are bounded (15 s, 5 s for the site's
reads), a request waits at most 5 s for a connection, and the site's reads of the API give up after 8 s.
