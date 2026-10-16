# First deploy

Brings aisafety-newsroom up on the cluster for the first time (SPEC M0). Already done in gitops: the Argo CD
Application, the `newsroom` database and its roles, the sealed secrets (`scripts/seal-gitops-secrets.sh`), and this
repo's self-hosted runner, with the job-started hook that limits it to releases started by hand
(`docs/runbooks/release.md`).

The commands read the infrastructure's names from `scripts/ops.env` (keys in `scripts/ops.env.example`):

```sh
set -a; . scripts/ops.env; set +a
```

## 1. Push this repo

The first push needs no changeset: the pre-push hook skips its checks while `origin/main` doesn't exist, and CI skips
the checks that compare with a previous commit.

```sh
git push -u origin main
```

CI (checks and database tests) runs on GitHub-hosted runners.

## 2. Release

Once CI has passed on `main`, start the release by hand:

```sh
gh workflow run release.yml
gh run watch   # pick the 📦 Release run
```

The release finds both deployables ahead of the umbrella chart (no tags yet), builds
`$REGISTRY/aisafety-newsroom/{api,migrations}` as `<version>.<short sha>` for `linux/amd64` on the self-hosted
runner, pushes them, and commits the tags into `helm-charts/aisafety-newsroom/values.yaml` ("Release: update image
tags [skip ci]").

Check: both images in the registry's `aisafety-newsroom` project, and the tags commit on `main`.

## 3. Turn the Application on in gitops

The API's host is the public host (SPEC D8; `NEWSROOM_URL`). Add the app's values file in gitops
(`GITOPS_APP_VALUES`), with your registry, gateway and host in place of the placeholders:

```yaml
# aisafety-newsroom (danilupion/aisafety-newsroom). Image tags are not set here: the app repo's release workflow
# writes them into the umbrella chart's values.yaml.

aisafety-newsroom-migrations:
  image:
    repository: <registry>/aisafety-newsroom/migrations
  # Owner connection string (newsroom_owner): migrations only; the apps never connect as the owner.
  databaseUrlSecret:
    name: aisafety-newsroom-owner-db

aisafety-newsroom-api:
  image:
    repository: <registry>/aisafety-newsroom/api
  # The bearer token for /api/v1 and newsroom_app's connection, sealed by scripts/seal-gitops-secrets.sh.
  apiTokenSecret:
    name: aisafety-newsroom-api-token
  databaseUrlSecret:
    name: aisafety-newsroom-app-db
  # The API host on the public gateway: only /telegram/webhook and /api/v1 reach the API (SPEC §5).
  route:
    enabled: true
    parentRefs:
      - name: <public gateway>
        namespace: <its namespace>
    hostnames:
      - <host>
```

Run gitops' own checks, commit and push. Argo CD then creates the Application: the secrets and the ServiceAccount
patch (wave -2), the migration Job (wave -1), then the API. The host needs its DNS record and a certificate on the
gateway, however gitops provides them.

## 4. Check it

```sh
# 401: no token
curl -si "$NEWSROOM_URL/api/v1/items" | head -1
# 200: the token works. It reaches curl through stdin, never its arguments (which `ps` shows).
token="$(security find-generic-password -s aisafety-newsroom -a api-token -w)"
printf 'header = "Authorization: Bearer %s"\n' "$token" | curl -s -K - "$NEWSROOM_URL/api/v1/items"
unset token
```

From aisafety-media, `python3 tools/newsroom.py pending` does the same.

In the cluster: the migration Job succeeded, two API pods are ready, and `newsroom` has the `app` schema.

## If the migration Job can't pull its image

`kubectl --context "$KUBE_CONTEXT" -n aisafety-newsroom get events` showing `401 Unauthorized` on
`<registry>/v2/aisafety-newsroom/…` means the registry refuses the sealed pull credentials: the robot's secret was
refreshed (or mistyped) after sealing, or the robot can't pull from the project. Check the pull robot in the registry,
refresh its secret if unsure, then re-seal the pull secret alone, which leaves the passwords and the API token as they
are (`<gitops>` is your gitops checkout):

```sh
scripts/seal-registry-pull-secret.sh <gitops>
```

It asks the registry for a pull token first, so a wrong secret or a robot without pull rights stops it before
anything is sealed (`CHECK_ONLY=1` checks and seals nothing). Commit and push it in gitops. Argo CD retries the sync
once the secret changes; if it has given up, sync the Application by hand (the whole app, so the migration hook runs).
