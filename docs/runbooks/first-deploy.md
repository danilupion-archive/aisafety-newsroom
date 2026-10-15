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

Choose the API host (SPEC Q1), then add `clusters/example/values/apps/aisafety-newsroom.yaml`:

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
      - API_HOST.example.test
```

Validate (`make lint && make validate-kustomize` in gitops), commit and push. Argo CD then creates the Application:
the secrets and the ServiceAccount patch (wave -2), the migration Job (wave -1), then the API. external-dns publishes
the host, and the gateway's `*.example.test` certificate covers it.

## 4. Check it

```sh
# 401: no token
curl -si https://API_HOST.example.test/api/v1/items | head -1
# 404 {"error":"Not found"}: the token works, and the inbox routes come with M1
curl -s -H "Authorization: Bearer $(security find-generic-password -s aisafety-newsroom -a api-token -w)" \
  https://API_HOST.example.test/api/v1/items
```

In the cluster: the migration Job succeeded, two API pods are ready, and `newsroom` has the `app` schema.
