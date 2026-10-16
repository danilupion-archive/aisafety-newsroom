# @aisafety-newsroom/observability

## 0.1.1

### Patch Changes

- b8cc1c8: No infrastructure named in the code, the charts or their comments: the repo is public. Releases start by hand and build
  on a runner that refuses everything else.

## 0.1.0

### Minor Changes

- b2d03f7: Error tracking (SPEC §15): the API, the worker and the site's server report to GlitchTip through the Sentry SDK, errors
  only, with aiontheballot's privacy options; off until gitops gives each its DSN
