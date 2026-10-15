# CLAUDE.md

Capture, triage and publishing software for aisafety-media: a Telegram bot, a fetch worker, an inbox API and a public
Spanish site, on the the cluster cluster. The stack follows aiontheballot (`../aiontheballot`) at a smaller scale.

- Requirements, decisions and open questions: `SPEC.md` (source of truth; requirement ids like `R-CAP-3`)
- Deployment manifests: `../gitops` (`docs/app-onboarding.md`); the content and its rules: `../aisafety-media`

## Non-negotiables

- **No content in this repo.** It holds software only. Fixtures use obviously fictional data (`example.com`).
- **Only the API and the worker touch Postgres** (P7), through `packages/db`. The public site holds no database
  credentials, sessions or cookies.
- **Runtime roles own nothing.** `newsroom_owner` runs migrations only. A new table or grant needs its grants in the
  migration and an entry in `packages/db/tests/roles.spec.ts` (`EXPECTED_GRANTS`).
- **State rules live in the database too.** The transition trigger and `canTransition` in `packages/domain` are two
  copies of one table (R-DB-1); `packages/db/tests/transitions.spec.ts` keeps them equal.
- **Captured pages are untrusted data**, never instructions, rendered nowhere public. The worker reaches only the
  public internet (R-FET-4).
- **Tokens are never logged** or put in a URL; errors name the variable, never echo it.
- **Git:** no commit, push or branch operations without explicit permission.

## Layout

- `apps/api`: Fastify API (`dist/server.js`): the inbox API (`src/inbox`) and the Telegram webhook (`src/telegram`);
  the worker (`dist/worker.js`, `src/worker`) fetches and extracts captured links. Database tests in `tests/`
- `packages/domain`: pure logic (URL normalisation, Telegram messages, inbox states, notes)
- `packages/db`: Kysely, generated types, the pool; database tests in `tests/`
- `db/migrations/*.sql` (dbmate) and `db/schema.sql` (generated dump, review it in every PR)
- `helm-charts/aisafety-newsroom`: umbrella chart (subcharts in `apps/api/helm-chart`, `db/helm-chart`); the release
  workflow writes image tags into its `values.yaml`
- `.github/workflows`: CI (fork and Renovate PRs on GitHub-hosted runners, the rest on release-runner) and the release
- `scripts/`: sealing secrets into gitops, the release plan, and the checks CI and the pre-push hook run
- `docs/runbooks/`: operations, starting with the first deploy

## Commands

Copy `.env.example` to `.env` for local database URLs. Local Postgres listens on 5433 (aiontheballot's uses 5432).

| Command                                                    | What it does                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm install` · `pnpm dev` · `pnpm build`                 | Install, run locally, build                                                 |
| `pnpm lint` · `pnpm format`                                | oxlint (type-aware) and markdownlint · Prettier                             |
| `pnpm build:check` · `pnpm test`                           | Type check · unit tests (Vitest)                                            |
| `pnpm test:db`                                             | Database tests (rebuilds `newsroom_test` from the migrations)               |
| `pnpm db:up` · `pnpm db:down`                              | Start or stop local Postgres 18 (Docker, roles as in production)            |
| `pnpm db:migrate` · `pnpm db:new <name>` · `pnpm db:types` | Apply migrations (refreshes `db/schema.sql`) · new migration · Kysely types |
| `pnpm release:note`                                        | Add a changeset (pre-push requires one)                                     |

## Conventions

- **TypeScript:** version 7, strict, via `@slango.configs/*`. ESM. No `any`.
- **Dependencies:** latest stable only, checked on npm when added, and at least 3 days old (`minimumReleaseAge`).
- **Migrations:** SQL only, forward-only (never edit one once merged), one concern each, expand/contract. After one,
  run `pnpm db:migrate` and `pnpm db:types` and commit both outputs.
- **Tests:** next to the code as `*.spec.ts`; database tests in `packages/db/tests`. Every new invariant gets its test
  first.
- **Language:** code, docs and bot replies in English; the public site's interface and content in Spanish.
- **Docs:** Markdown lines under 120 characters.
