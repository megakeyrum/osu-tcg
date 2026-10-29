# osu! Card Arena — independent Cloudflare edition

Owner osu! ID: **15336211**. All other visitors start as players, regardless of who signs in first.

## Apply this update

Extract the update ZIP. Upload every file and folder inside `osu-tcg` to the ROOT of your existing GitHub repository, replacing matching files. Preserve the folder structure.
This update does not require deleting the old prototype files: they are no longer referenced by the active build.

The active entrypoints are `index.html`, `src/main.tsx`, `vite.config.ts`, and `worker/index.mjs`.
`app/chatgpt-auth.ts`, `app/api/arena/route.ts`, `.openai`, and the old Sites scripts are unused by this edition.

## Deployment setup, in order

1. Create a Cloudflare D1 database named `osu-tcg`.
2. Copy its Database ID into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
3. In that database's console, execute the SQL from `migrations/0001_initial.sql` (or run `pnpm db:remote` with Wrangler authenticated).
4. Connect the GitHub repository to a Cloudflare **Worker**. Use the repository root, build command `pnpm build`, and deploy command `pnpm exec wrangler deploy`.
5. The initial deployment can display the sandbox without OAuth credentials. Copy its assigned HTTPS URL into `SITE_URL` in `wrangler.jsonc`.
6. In your osu! account settings, register an OAuth application with callback URL:
   `https://YOUR_ACTUAL_WORKER_HOST/auth/osu/callback`
   Use the exact deployed URL, not the placeholder above.
7. Put the application's Client ID in `OSU_CLIENT_ID` in `wrangler.jsonc`.
8. Add `OSU_CLIENT_SECRET` as a **secret** in Cloudflare's Worker settings. Never commit it to GitHub or paste it into chat.
9. Redeploy with the updated configuration. Open the site and sign in with osu!. User 15336211 receives owner access.
10. Have friends sign in, then assign admins from Organizer. Test real accounts before using the app in a tournament.

You do not need a custom domain. If you add one later, update both `SITE_URL` and the osu! application's callback URL.

## Local checks

Requires Node.js 22.13+ and the pnpm version pinned in package.json.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm exec wrangler deploy --dry-run
```

For a local sandbox, `pnpm dev` starts Vite. `pnpm preview` serves the built frontend and Worker together.
For local OAuth testing, use a separate osu! OAuth application and `.dev.vars` with `SITE_URL=http://localhost:8787`, `OSU_CLIENT_ID`, and `OSU_CLIENT_SECRET`.
Apply `pnpm db:local` before testing local persistence. Never commit `.dev.vars`.

## Security and data

- Login uses osu!'s authorization-code flow with the `identify` scope.
- Login state is bound to an HttpOnly browser cookie, expires in 10 minutes, and is consumed once in D1.
- Sessions last seven days, use HttpOnly/SameSite cookies, and are stored as token hashes in D1.
- No ChatGPT authentication headers are trusted by the independent Worker.
- State mutations check session identity, roles, origin and optimistic concurrency version.
- The owner ID is configured server-side. Admin roles can be granted by the owner.
- This starts a new database; it does not copy accounts or inventories from the private prototype.

## Game implementation status

Modernized sheet: 41 card definitions, 27 artifacts, 14 archived old cards. Unnamed entries remain explicitly unnamed. Mana costs and effect text come from the sheet.

Collection, deck saving, organizer awards, packs, trading and the basic round loop are implemented.
The unnamed +6% round card and Higher Score are automated. Stone is unplayable.
Other complex effects, artifact passives and most keyword lifecycle rules are **not automated**. Pack odds remain provisional and uniform over eligible playable cards.

## Validation

Game/catalog tests, mocked OAuth/security tests, TypeScript checking, the production frontend build, and Wrangler's deployment dry run were run during preparation.
Live osu! OAuth and Cloudflare persistence still require validation after you configure your actual account, database and secret.
