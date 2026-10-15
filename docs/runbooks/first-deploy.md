# First deploy

Brings aisafety-newsroom up on the cluster for the first time (SPEC M0). Already done in gitops: the catalog
ApplicationSet, the `newsroom` database and its roles, the sealed secrets, and this repo's runner on release-runner.

## 1. Push this repo

The first push needs no changeset: the pre-push hook skips its checks while `origin/main` doesn't exist, and CI skips
the checks that compare with a previous commit.

```sh
git push -u origin main
```

## 2. Let CI and the release run

On the self-hosted runner: **CI** (checks and database tests), then **Release**. The release finds both deployables
ahead of the umbrella chart (no tags yet), builds `registry.example.test/aisafety-newsroom/{api,migrations}` as
`<version>.<short sha>` for `linux/amd64`, pushes them, and commits the tags into
`helm-charts/aisafety-newsroom/values.yaml` ("Release: update image tags [skip ci]").

Check: both images in the registry's `aisafety-newsroom` project, and the tags commit on `main`.

## 3. Turn the Application on in gitops

The API host is `newsroom.danilupion.com` (SPEC D8). Add `clusters/example/values/apps/aisafety-newsroom.yaml`:

```yaml
# aisafety-newsroom (danilupion/aisafety-newsroom). Image tags are not set here: the app repo's release workflow
# writes them into the umbrella chart's values.yaml.

aisafety-newsroom-migrations:
  image:
    repository: registry.example.test/aisafety-newsroom/migrations
  # Owner connection string (newsroom_owner): migrations only; the apps never connect as the owner.
  databaseUrlSecret:
    name: aisafety-newsroom-owner-db

aisafety-newsroom-api:
  image:
    repository: registry.example.test/aisafety-newsroom/api
  # The bearer token for /api/v1 and newsroom_app's connection, sealed by scripts/seal-gitops-secrets.sh.
  apiTokenSecret:
    name: aisafety-newsroom-api-token
  databaseUrlSecret:
    name: aisafety-newsroom-app-db
  # The API host on the public gateway: only /telegram/webhook and /api/v1 reach the API (SPEC §5).
  route:
    enabled: true
    parentRefs:
      - name: example-gateway
        namespace: example-gateway
    hostnames:
      - newsroom.danilupion.com
```

Validate (`make lint && make validate-kustomize` in gitops), commit and push. Argo CD then creates the Application:
the secrets and the ServiceAccount patch (wave -2), the migration Job (wave -1), then the API. external-dns publishes
the host, and the gateway's `*.example.test` certificate covers it.

## 4. Check it

```sh
# 401: no token
curl -si https://newsroom.danilupion.com/api/v1/items | head -1
# 200: the token works. It reaches curl through stdin, never its arguments (which `ps` shows).
token="$(security find-generic-password -s aisafety-newsroom -a api-token -w)"
printf 'header = "Authorization: Bearer %s"\n' "$token" | curl -s -K - https://newsroom.danilupion.com/api/v1/items
unset token
```

From aisafety-media, `python3 tools/newsroom.py pending` does the same.

In the cluster: the migration Job succeeded, two API pods are ready, and `newsroom` has the `app` schema.

## If the migration Job can't pull its image

`kubectl -n aisafety-newsroom get events` showing `401 Unauthorized` on `registry.example.test/v2/aisafety-newsroom/…`
means the registry refuses the sealed pull credentials: the robot's secret was refreshed (or mistyped) after sealing, or the
robot lacks "pull repository" on the project. Check the robot in the registry (Projects → aisafety-newsroom → Robot
Accounts), refresh its secret if unsure, then re-seal the pull secret alone, which leaves the passwords and the API
token as they are:

```sh
scripts/seal-registry-pull-secret.sh <gitops>
```

Commit and push it in gitops. Argo CD retries the sync once the secret changes; if it has given up, sync the
Application by hand (the whole app, so the migration hook runs).
