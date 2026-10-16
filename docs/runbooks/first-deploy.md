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

## 5. Turn on the site

The site stays off until gitops gives it its host, its names and its editor (SPEC R-WEB-9). It reads the API inside
the cluster as `newsroom_public`, so the API needs that login too: without it `/public` answers 503 and every page of
the site fails with a 500. Add to the app's values file (`GITOPS_APP_VALUES`), with your own values:

```yaml
aisafety-newsroom-api:
  # newsroom_public's connection, sealed by scripts/seal-gitops-secrets.sh with the others.
  publicDatabaseUrlSecret:
    name: aisafety-newsroom-public-db

aisafety-newsroom-web:
  enabled: true
  image:
    repository: <registry>/aisafety-newsroom/web
  site:
    url: https://<site host>
    name:
      es: <name>
      en: <name>
    # Who picks and checks the texts (R-WEB-3), and, optional, a page about them that the name links to.
    author: <name>
    authorUrl: <https://…>
  # Optional: Plausible (the site's own pa-….js) and GlitchTip (docs/runbooks/error-tracking.md).
  analytics:
    scriptUrl: https://<plausible>/js/pa-….js
  errorTracking:
    dsnSecret:
      name: aisafety-newsroom-web-glitchtip
  route:
    enabled: true
    parentRefs:
      - name: <public gateway>
        namespace: <its namespace>
    hostnames:
      - <site host>
```

The site's host needs its DNS record and a certificate on the gateway, however gitops provides them; a `www.` host,
if you want one, is a redirect route in gitops beside the app's other resources.

Check it once Argo CD has synced (`SITE` is `https://<site host>`):

```sh
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/"      # 200: the Spanish home, which needs the API
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/en"    # 200
curl -s -o /dev/null -w '%{redirect_url}\n' "$SITE/es" # $SITE/: Spanish lives at the root
```

A 500 on `/` with a 200 on `/healthz` means the site is up but can't read the API: check the API's
`publicDatabaseUrlSecret` first.

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
