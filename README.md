# osu! Card Arena

Custom osu! tournament card-game prototype, inspired by Slay the Spire.

## What this export is

This is the editable source, including the Modernized Versions card sheet update.
It is ready to store in your GitHub repository. It is **not yet a standalone production deployment**.
The currently published ChatGPT Site is separate and is not updated by uploading this ZIP.
The original Site ID, repository credentials, local database, dependencies and build outputs are excluded.

## Included

- React interface, collection browser, deck builder, pack opening and card trades.
- Organizer awards for currency, packs and cards; owner-managed organizer roles.
- Five-card hands, three base mana per round, score entry and one-map score buffs.
- Server-side game actions, private match hands and optimistic concurrency checks.
- Cloudflare D1 schema and migration for persistent state.
- Modernized catalog: 41 playable-card definitions, 27 artifacts, 14 archived old cards.
- Names missing in the sheet have explicit `Unnamed` labels; unknown values remain unknown.
- Metadata includes sheet mana costs, rarity colors and keyword text.
- Basic automated effects: the unnamed +6% round card and Higher Score (+15,000).
- Artifacts, complex effects, and most keyword mechanics are catalogued but **not automated**.
  Stone cannot be played. Pack draws exclude artifacts, unobtainable entries and old cards.
  Pack odds remain uniform draft odds, not rarity-weighted odds.

## Upload to your GitHub account

1. Create an empty repository on GitHub, for example `osu-tcg`. Private is fine.
2. Extract this ZIP and open a terminal **inside the `osu-tcg` folder**.
3. Run the following, replacing the URL with the exact URL of your empty repository:

```sh
git init
git add .
git commit -m "Import osu tournament card game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/osu-tcg.git
git push -u origin main
```

Authenticate using GitHub's normal credential manager or GitHub CLI. Do not paste access tokens into source files or remote URLs.
Do not run these initialization steps inside an existing repository with unrelated work.
You can also open the extracted folder with GitHub Desktop and publish a new repository.

## Local development

Install Node.js 22.13 or newer and the pnpm version listed in `package.json`.
From this directory:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

Apply the local database migration once, then start development:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_redundant_blue_shield.sql
pnpm dev
```

Open the URL printed by the development server (normally http://localhost:5173).
The unauthenticated interface provides an in-memory sandbox. Its state resets on refresh.
The retained starter also provides loopback-only mock ChatGPT sign-in for local database testing;
this is a development identity, not a real osu! account. See `STARTER-NOTES.md`.

## Before independent hosting

GitHub stores the code; GitHub Pages cannot run this server and database.
The current stack uses Vinext/React, Cloudflare Workers and D1.

The following work is still required before running a public tournament outside ChatGPT Sites:

1. Replace `app/chatgpt-auth.ts` and its usage in `app/api/arena/route.ts` with secure osu! OAuth sessions.
   The current trusted authentication headers are supplied by ChatGPT Sites and must NOT be accepted
   from arbitrary internet requests on an independently hosted Worker.
2. Register your osu! OAuth application. Configure a fixed callback URL and keep its client secret
   in the host's secret storage. Validate OAuth state and use secure server-issued sessions.
3. Replace first-visitor owner assignment in `lib/engine.mjs` with an explicit owner osu! user ID.
   First-visitor assignment is only appropriate behind the existing owner-private Site access gate.
4. Replace the Sites-specific deployment configuration with your own Worker and D1 configuration.
   The zero UUID in the local Vite binding is a development placeholder, not a production database.
5. Apply migrations to your own D1 database, configure secrets and deploy under your account.
6. Test two genuine player accounts, admin authorization, pack concurrency, trading and persistence.
7. Implement and balance the remaining card/artifact rules before competitive use.

No osu! client secret, GitHub token, Cloudflare token, or production database is included in this export.

## Main files

- `app/arena.tsx`: interface and sandbox.
- `app/globals.css`: styling.
- `app/api/arena/route.ts`: authenticated game API and D1 persistence.
- `lib/engine.mjs`: authoritative game actions and per-player views.
- `lib/catalog.json`: Modernized Versions catalog.
- `lib/catalog-update.mjs`: catalog update that preserves owned copies and snapshots live hands.
- `db/schema.ts`, `drizzle/`: database schema and migration.
- `tests/`: game rules and catalog tests.

The `.gitignore` excludes secrets, dependencies, generated files and local database state.
Third-party dependency licenses remain applicable; the vendored Sites plugin license is retained.
