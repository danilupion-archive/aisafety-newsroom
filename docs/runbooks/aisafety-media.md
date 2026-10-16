# Using the newsroom from aisafety-media

aisafety-media is the newsroom's only client (SPEC §10): `tools/newsroom.py` for the inbox and the site's posts,
`tools/miniflux.py` for `/sweep`'s feeds. Both are Python stdlib only and read their tokens from the Mac's Keychain.

## Once, on the Mac

1. **The API token** is already in the Keychain (service `aisafety-newsroom`, account `api-token`): the seal script
   stored it. Check it from aisafety-media:

   ```sh
   python3 tools/newsroom.py pending
   ```

   "0 waiting." means the token works. A 401 means it was rotated without the Keychain: `docs/runbooks/api-token.md`.

2. **A Miniflux API key**, for `/sweep`: in Miniflux, Settings › API Keys › Create a new API key. Store it (the
   command prompts for it, hidden):

   ```sh
   security add-generic-password -s miniflux -a api-token -w
   ```

3. **The feeds**: `python3 tools/miniflux.py setup` creates the `aisafety` category and subscribes it to the feeds in
   `news/watchlist.md` › Where to look › Feeds, with their `keep:` filters. Run it again whenever that list grows;
   `python3 tools/miniflux.py feeds` shows any feed that fails. Everything the tool does stays inside the category.

## Day to day

| Where          | What                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Telegram       | Send the bot a link, with a note if you like: "Saved #n", then the page's title                                           |
| aisafety-media | `/news` with no arguments logs everything waiting, one item file each (queue mode)                                        |
| aisafety-media | `/sweep` reads the feeds first, then searches only what they don't cover                                                  |
| aisafety-media | `/breve <item> [en]` drafts a breve in both languages, Spanish first unless `en`; approve both, commit, `/post es/<slug>` |
| aisafety-media | `/breve translate es/<slug>` redrafts a story's other version after its original changed (R-WEB-10)                       |
| aisafety-media | `/post` with no arguments compares the site with `posts/`                                                                 |

`/news <url>` (direct mode) never needs the newsroom. If the API can't be reached, queue mode says so and stops;
the items wait in the inbox.

Every post goes up in both languages (SPEC D11): `/post` pushes the story's two versions, and the site shows it once
both are up; `/post unpublish` takes both down. Posts' addresses are on the API's host (SPEC D10):
`https://newsroom.danilupion.com/es/<slug>`. `NEWSROOM_SITE_URL` changes the host `tools/newsroom.py` prints them on.

## Testing a change locally

The tools take `NEWSROOM_API_URL` and `MINIFLUX_URL` (plain `http://` only for localhost), and `NEWSROOM_TOKEN` and
`MINIFLUX_TOKEN` instead of the Keychain. Run the API from this repo against local Postgres with a throwaway
`API_TOKEN`, and the tools from a copy of aisafety-media in its own git repository: `post` records commits, and the
commands that change files leave them uncommitted.
