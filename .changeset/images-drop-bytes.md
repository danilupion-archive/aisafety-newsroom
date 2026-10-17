---
'@aisafety-newsroom/api': patch
'@aisafety-newsroom/migrations': minor
---

Images on a volume, step 2b: the database drops the image byte columns (their sizes required, filled for any row that
lacked them), and the public image view comes back without them. The API reads the recorded sizes directly.
