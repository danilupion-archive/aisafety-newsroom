# Error tracking

The API, the worker and the site's server report errors to GlitchTip (SPEC §15), as aiontheballot's apps do: through
the Sentry SDK, errors only, with no personal data (`packages/observability`). Each has its own project. Without a DSN
nothing is reported, which is how it runs until this is set up.

What each reports:

- **API:** every 5xx (never its message to the client), a Telegram reply that couldn't be sent, a webhook that
  couldn't be registered.
- **Worker:** a round that failed and a reply it couldn't edit, by the error's class only (a message could quote a
  page); items waiting in the queue for more than an hour, at most every half hour.
- **Site:** every error a request hits on the server. Nothing runs in the browser (R-WEB-7).

## Set it up

1. **Create three projects** in GlitchTip (its UI is on the private network): `aisafety-newsroom-api`,
   `aisafety-newsroom-worker` and `aisafety-newsroom-web`, platform Node.js.

2. **Seal their DSNs** in a terminal. Paste each from the project's settings (Client Keys); the script rewrites the
   host to GlitchTip's in-cluster Service:

   ```sh
   scripts/seal-glitchtip-dsns.sh <gitops>
   ```

3. **Configure them** in gitops' `clusters/example/values/apps/aisafety-newsroom.yaml`:

   ```yaml
   aisafety-newsroom-api:
     errorTracking:
       dsnSecret:
         name: aisafety-newsroom-api-glitchtip
     worker:
       errorTracking:
         dsnSecret:
           name: aisafety-newsroom-worker-glitchtip
       networkPolicy:
         # The worker's policy lets it reach only what it lists: GlitchTip's web pods too.
         errorTracking:
           namespace: glitchtip
           podLabels:
             app.kubernetes.io/name: glitchtip
             app.kubernetes.io/component: web
   aisafety-newsroom-web:
     errorTracking:
       dsnSecret:
         name: aisafety-newsroom-web-glitchtip
   ```

   Commit it with the sealed secrets, and push.

4. **Check:** the worker logs `worker started`, and an error shows up in its project when one happens. To see one on
   purpose, stop the database's port to the worker for a round (or wait for the first real one).

To rotate a DSN, delete its sealed file, run the script again, and restart the component.
