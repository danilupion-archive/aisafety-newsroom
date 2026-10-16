# Releasing

Releases are started by hand. Once CI has passed on `main`:

```sh
gh workflow run release.yml
gh run watch   # pick the 📦 Release run
```

The workflow (`.github/workflows/release.yml`) has three jobs:

1. **Tested commit**, on a GitHub-hosted runner: finds the newest commit on `main` that CI passed on. If `main` has
   moved past it, nothing happens: either CI hasn't finished on a newer commit (release once it passes), or the newer
   commits are a release's own.
2. **Version**, on the self-hosted runner: applies the changesets (versions and changelogs) and commits
   "Release: bump versions [skip ci]".
3. **Build and deploy**, on the self-hosted runner: builds and pushes the image of every deployable whose version is
   ahead of the umbrella chart, writes their tags into `helm-charts/aisafety-newsroom/values.yaml` ("Release: update
   image tags [skip ci]") and tags the commit. Argo CD deploys `main`.

The release pushes to `main`, so `git pull --rebase` before pushing again.

## The self-hosted runner

The runner takes a job only when its owner started the run by hand (`workflow_dispatch`, or a re-run) from the
workflow as it is on `main`. A job-started hook on the runner itself, configured in gitops with the runner, checks
that before the job's first step, from what GitHub sets about the run, which no workflow file can change. Pushes,
pull requests (a fork's, Renovate's, your own) and schedules never run there; CI runs on GitHub-hosted runners.

A job the hook refuses fails in "Set up runner" with "Refused by this runner: …".

## When a release fails

- **Before Version commits:** start it again.
- **After it:** re-run the failed jobs (`gh run rerun <run id> --failed`). They work on the same commit. A new release
  wouldn't: `main` now ends with the version commit, which CI skips, so it finds nothing to do until the next push.
- **Building the images:** the step tries three times. A build that fails all three stops the release before any tag
  is written; fix it, push, and release again once CI passes.
