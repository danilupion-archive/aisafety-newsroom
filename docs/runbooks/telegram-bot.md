# Telegram bot

Setting up the capture bot (SPEC §6) and rotating its token. The commands read the cluster's names from
`scripts/ops.env` (keys in `scripts/ops.env.example`); `<gitops>` is your gitops checkout.

## Set it up

1. **Create the bot** in Telegram with [@BotFather](https://t.me/BotFather) (`/newbot`), which answers with its token.

2. **Find your Telegram user id**, for the allowlist (R-CAP-1): message [@userinfobot](https://t.me/userinfobot).

3. **Run the setup** in a terminal:

   ```sh
   scripts/seal-telegram-secret.sh <gitops>
   ```

   It asks for the token (hidden) and your user id, then: checks the token with Telegram and names the bot it belongs
   to (nothing is sealed if Telegram refuses it); sets the bot's command list, so BotFather's `/setcommands` isn't
   needed; seals the token with a new webhook secret; and writes the bot's settings (`telegram:` under
   `aisafety-newsroom-api`, the webhook at `$NEWSROOM_URL/telegram/webhook` unless `WEBHOOK_URL` says otherwise) into
   the app's values file in gitops (`GITOPS_APP_VALUES`).

4. **Review, commit and push** both files in gitops (`git diff` shows the values; the sealed file is new). Argo CD
   rolls the API out with the bot's settings, and the API registers the webhook with Telegram when it starts.

5. **Check it:** send the bot `/help`, then a link. It answers "Saved #n" within seconds, and the worker edits that
   reply with the page's title within a minute or two.

The bot only answers once the API is deployed: the first deploy must have gone through (`docs/runbooks/first-deploy.md`).

## Rotate the token

In BotFather, `/revoke` for the bot gives a new token. In gitops, delete `aisafety-newsroom-telegram.yaml` (in
`GITOPS_APP_SECRETS_DIR`) and the `telegram:` block of the values, run the setup again, commit and push. The values
come back the same, so the API's pods don't change on their own: restart them so they read the new secret and register
the webhook again:

```sh
set -a; . scripts/ops.env; set +a
kubectl --context "$KUBE_CONTEXT" -n aisafety-newsroom rollout restart deployment/aisafety-newsroom-api
```

## When nothing answers

- Telegram's view of the webhook: its address, its last error and how many updates are waiting (it keeps undelivered
  updates for 24 hours). The token is read hidden and reaches curl through stdin, so it's in neither the shell's
  history nor `ps`:

  ```sh
  read -rs token && printf 'url = "https://api.telegram.org/bot%s/getWebhookInfo"\n' "$token" | curl -s -K -; unset token
  ```

- The API's logs show a 401 for each update if the webhook's secret doesn't match the sealed one: restart the API, which
  registers the webhook again with the sealed secret.
- Messages from a user id that isn't on the allowlist, or from a group, are ignored without a reply, on purpose.
