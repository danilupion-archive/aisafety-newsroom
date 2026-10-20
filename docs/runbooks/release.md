# Releasing

Releases follow CI (SPEC D24), as aiontheballot's do: once CI passes on your push to `main`, the 📦 Release workflow
starts and deploys it. Watch it with `gh run watch`. A push to `main` is a deployment.

A release can also be started by hand, once CI has passed on `main` (after a failed release, or after CI started by
hand):

```sh
gh workflow run release.yml
gh run watch   # pick the 📦 Release run
```

The workflow (`.github/workflows/release.yml`) has three jobs:

1. **Tested commit**, on a GitHub-hosted runner: after CI, the commit that run passed on, if it was your push to
   `main` in this repository (anything else, a pull request's run above all, is skipped); by hand, the newest commit on
   `main` that CI passed on, in a push's run or one started by hand (`gh workflow run ci.yml`, which skips the checks
   that compare with the previous push). If `main` has moved past it, nothing happens: CI hasn't finished on a newer
   commit, whose release will include this one, or the newer commits are a release's own.
2. **Version**, on the self-hosted runner: applies the changesets (versions and changelogs) and commits
   "Release: bump versions [skip ci]".
3. **Build and deploy**, on the self-hosted runner: builds and pushes the image of every deployable whose version is
   ahead of the umbrella chart, writes their tags into `helm-charts/aisafety-newsroom/values.yaml` ("Release: update
   image tags [skip ci]") and tags the commit. Argo CD deploys `main`.

The release pushes to `main`, so `git pull --rebase` before pushing again.

## The self-hosted runner

The runner takes a job only when it runs a workflow as it is on `main`: a push, the release after CI
(`workflow_run`), a schedule or a run by hand (`workflow_dispatch`, or a re-run). A job-started hook on the runner
itself, the one the organisation runners share, configured in gitops, checks that before the job's first step, from
what GitHub sets about the run, which no workflow file can change. Every pull request is refused (a fork's,
Renovate's, your own); CI runs on GitHub-hosted runners. A pull request's CI still completes on `main`'s release
workflow: the release's own condition (your push to `main`, in this repository) is what skips it.

A job the hook refuses fails in "Set up runner" with "Refused by this runner: …".

## When a release fails

- **Before Version commits:** start it again.
- **After it:** re-run the failed jobs (`gh run rerun <run id> --failed`). They work on the same commit. A new release
  wouldn't: `main` now ends with the version commit, which CI skips, so it finds nothing to do until the next push.
- **Building the images:** the step tries three times. A build that fails all three stops the release before any tag
  is written; fix it, push, and release again once CI passes.
