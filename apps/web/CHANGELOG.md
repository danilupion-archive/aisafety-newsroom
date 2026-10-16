# @aisafety-newsroom/web

## 0.1.0

### Minor Changes

- b2d03f7: Error tracking (SPEC §15): the API, the worker and the site's server report to GlitchTip through the Sentry SDK, errors
  only, with aiontheballot's privacy options; off until gitops gives each its DSN
- ff0a258: The public Spanish site (SPEC §13): latest posts, a page per post with its sources, tag pages, the about page, an Atom
  feed, a sitemap; unpublished posts answer 410; off until gitops gives it its name, address and author

### Patch Changes

- Updated dependencies [b2d03f7]
- Updated dependencies [f26e12b]
  - @aisafety-newsroom/observability@0.1.0
  - @aisafety-newsroom/domain@0.2.0
