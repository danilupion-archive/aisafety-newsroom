# Rotating the API token

The bearer token is the only lock on `/api/v1` (R-API-2): rotate it if it may have leaked, or as a habit. The old
token stops working once the API restarts with the new one; until then both the API and the Mac keep working with
the old.

1. **Seal a new token** in a terminal. It replaces the sealed secret in gitops and the Keychain item
   (`aisafety-newsroom` / `api-token`) that `tools/newsroom.py` reads:

   ```sh
   scripts/seal-api-token.sh <gitops>
   ```

2. **Commit and push** `clusters/example/resources/apps/aisafety-newsroom/secrets/aisafety-newsroom-api-token.yaml`
   in gitops. Argo CD updates the Secret, but the running pods keep the old value.

3. **Restart the API** so it reads the new one:

   ```sh
   kubectl --context "$KUBE_CONTEXT" -n aisafety-newsroom rollout restart deployment/aisafety-newsroom-api
   ```

4. **Check:** without a token, `curl -si https://newsroom.danilupion.com/api/v1/items | head -1` answers `401`; with
   the Keychain's, `python3 tools/newsroom.py pending` in aisafety-media answers.

If the Keychain item is lost but the cluster still has the token, read it back (it's printed, so only in a terminal
nobody records): `kubectl --context "$KUBE_CONTEXT" -n aisafety-newsroom get secret aisafety-newsroom-api-token -o
jsonpath='{.data.API_TOKEN}' | base64 -d`. Rotating is usually the better answer.
