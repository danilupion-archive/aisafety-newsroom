---
'@aisafety-newsroom/api': minor
'@aisafety-newsroom/migrations': minor
---

Images live only on the API's volume (D22, step 2a): uploads write the two WebP files and a row with their sizes, never
the bytes; serving reads only the file, and a missing one is a 404 logged by its SHA-256 (the same upload writes it
again). Without IMAGES_DIR the image routes answer 503. The byte columns are optional and the public view no longer
reads them; step 2b drops them. The start-up backfill is gone.
