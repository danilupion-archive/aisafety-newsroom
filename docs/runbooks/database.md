# The database: losing it, restoring it, re-pushing posts

The `newsroom` database lives on the cluster's shared Postgres. What it holds, and what losing it costs:

| Table                  | If lost                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `app.inbox_items`      | Items not yet logged are gone (logged ones are already in aisafety-media's news log, the record, P1) |
| `app.posts`            | Nothing: every post is pushed again from aisafety-media (R-WEB-8)                                    |
| `app.telegram_updates` | Nothing: only stops a redelivered update from being processed twice                                  |

## Backups

They follow the cluster's plan (gitops `docs/backup-policy-plan.md`, TASK-005: a nightly `pg_dump -Fc` of every
database, copied off the node by cluster backups), which **isn't running yet**. Until it is, the risk above is accepted (SPEC
§15).

## Restoring from a dump

Once dumps exist, restore into the existing, empty database, as the owner, so the grants to the runtime roles come
back with it:

```sh
# on a machine that reaches the cluster; the dump is newsroom.dump
kubectl --context "$KUBE_CONTEXT" -n postgresql exec -i postgresql-0 -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U postgres -d newsroom --clean --if-exists --no-owner \
    --role=newsroom_owner' < newsroom.dump
```

Then restart the API and the worker (`kubectl -n aisafety-newsroom rollout restart deployment`), and check
`/pending` in Telegram.

## Starting again from empty

If there's no dump: drop the `app` and `private` schemas and `public.schema_migrations` as `newsroom_owner`, then
sync the Application in Argo CD (the whole app, so the migration Job runs). The inbox starts empty; then re-push the
posts.

## Re-pushing every post (R-WEB-8)

From aisafety-media, push every post the site had again: `python3 tools/newsroom.py post --all` (`/post all`) sends each
published one, and each unpublished one as unpublished (its address answers 410 again), with `PUT
/api/v1/posts/:lang/:slug`, originals before their translations, the about pages (`es/sobre`, `en/about`) included.
`GET /api/v1/posts` lists what the site has, unpublished ones included, to compare against. Pushing is idempotent: a
post pushed twice is the same post (R-API-3).
