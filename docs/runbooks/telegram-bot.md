# Telegram bot

Setting up the capture bot (SPEC §6), and rotating its token.

## Set it up

1. **Create the bot.** In Telegram, talk to [@BotFather](https://t.me/BotFather): `/newbot`, a name and a username.
   It answers with the bot's token. Optionally, `/setprivacy` → Enable (the bot only works in private chats anyway),
   and `/setcommands` with:

   ```text
   pending - What is waiting for /news
   discard - Drop an item: /discard <id> [reason]
   restore - Bring a discarded item back: /restore <id>
   note - Add to an item's note: /note <id> <text>
   help - How to use the bot
   ```

2. **Find your Telegram user id**, for the allowlist (R-CAP-1): message [@userinfobot](https://t.me/userinfobot), which
   replies with it.

3. **Seal the token** in a terminal (it asks for it, hidden, and generates the webhook secret):

   ```sh
   scripts/seal-telegram-secret.sh <gitops>
   ```

4. **Configure the API** in gitops' `clusters/example/values/apps/aisafety-newsroom.yaml`, under
   `aisafety-newsroom-api`:

   ```yaml
   telegram:
     secret:
       name: aisafety-newsroom-telegram
     allowedUserIds: '<your user id>'
     webhookUrl: https://newsroom.danilupion.com/telegram/webhook
   ```

   Commit it with the sealed secret, and push. The API registers the webhook with Telegram when it starts.

5. **Check it:** send the bot `/help`, then a link. It answers "Saved #n" within seconds.

## Rotate the token

In BotFather, `/revoke` for the bot gives a new token. Delete
`clusters/example/resources/apps/aisafety-newsroom/secrets/aisafety-newsroom-telegram.yaml` in gitops, run the
script again, commit and push, then restart the API so it reads the new secret and registers the webhook again:
`kubectl -n aisafety-newsroom rollout restart deployment/aisafety-newsroom-api`.

## When nothing answers

- `curl -s "https://api.telegram.org/bot<token>/getWebhookInfo"` shows the webhook's address, its last error and how
  many updates are waiting. Telegram keeps undelivered updates for 24 hours.
- The API's logs show a 401 for each update if the webhook's secret doesn't match the sealed one: restart the API, which
  registers the webhook again with the sealed secret.
- Messages from a user id that isn't on the allowlist, or from a group, are ignored without a reply, on purpose.
