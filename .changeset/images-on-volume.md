---
'@aisafety-newsroom/api': minor
---

Images' files on a volume (D22, step 1): with IMAGES_DIR set (the chart's `imageStore`), uploads also write each
image's two WebP files there, the site's image route serves the file once the database allows the image (healing a
missing one from the database), the API copies in at start every image the volume lacks, and `GET /api/v1/images`
counts what the volume holds. The database keeps the bytes too until step 2. Off by default.
