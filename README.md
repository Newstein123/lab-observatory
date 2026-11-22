# Universal Observatory

Configure a telescope, simulate what it shows, and keep your setups.

MVP scope: Visual Astronomy, Telescope Lab, My Observatory, and the Astronomical Object Explorer inside the Lab's view.

**Stack:**
- Next.js 15 (App Router) with React 19 and TypeScript.
- A TypeScript simulation engine in `src/modules/simulations/engine`, with formulas and assumptions listed in `constants.ts`.
- Supabase (Postgres, Auth) with row-level security on every table.
- Vitest for unit tests and Playwright for end-to-end tests.

## Local development

You need Node 22+, pnpm 10 and Docker (for local Supabase).

```bash
pnpm install
cp .env.example .env.local   # fill from `pnpm exec supabase status`
make start                   # Docker → Supabase → phone tunnel → dev server on :3000
make stop                    # from any terminal
```

To run only the app: `pnpm db:start` once, then `pnpm dev`.

Output folders are kept separate so processes never overwrite each other:

| Process | Folder |
|---|---|
| `next dev` | `.next-dev` |
| `next build` / `next start` | `.next` |
| e2e test server | `.next-e2e` |
| Anything else | set `NEXT_DIST_DIR` |

Local Supabase (`supabase/config.toml`) disables Studio, Storage, Realtime, Analytics and Edge Functions to save disk. Mailpit captures auth emails at http://127.0.0.1:54324.

## Tests

| Command | What it runs |
|---|---|
| `pnpm typecheck && pnpm lint` | TypeScript, ESLint |
| `pnpm test` | Unit tests: engine, ephemerides, renderers, persistence contract (local storage) |
| `pnpm test:db` | The same repository contract against local Supabase: row-level security, cross-user isolation, constraints |
| `pnpm test:e2e` | Playwright on a production build (port 3100). Desktop Chrome and Pixel 7 |
| `make test` | All of the above |

CI (`.github/workflows/ci.yml`) runs all of these on every push and pull request.

E2E tests pin the observing time and place (`pinSky` in `e2e/helpers.ts`), so what's above the horizon never depends on when they run.

## Environment variables

| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes (production) | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes (production) | Publishable (anon) key only. Never put the service-role key in the app |
| `ALLOW_BROWSER_ONLY_BUILD` | no | Set to `1` to build the no-accounts version on purpose. Without it, a production build fails when Supabase isn't configured |

## Deploying

### 1. Supabase (hosted)

1. Create the project, then apply the migrations from this repo:
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
2. Under **Authentication → URL configuration**:
   - Set the Site URL to `https://<your-domain>`.
   - Add these redirect URLs: `https://<your-domain>/auth/reset` and `https://<your-domain>/auth/callback`.
3. Under **Authentication → Emails**:
   - Configure custom SMTP. The built-in sender is heavily rate-limited and not meant for production.
   - Review the confirmation and password-reset templates.
4. Under **Authentication → Providers → Email**:
   - Decide whether to enable *Confirm email*. Sign-up handles both cases: with confirmation on, the link lands on `/auth/callback`.
   - Set the minimum password length to 8, matching the app.
5. Raise the auth email rate limits to suit expected sign-ups.
6. Check that row-level security is enabled on every table. The Security Advisor should report no issues.

Auth email links use PKCE, so they must be opened in the same browser that requested them. The app says so on both pages.

### 2. App (e.g. Vercel)

- Set the two `NEXT_PUBLIC_SUPABASE_*` variables for Production and Preview, then deploy `main`.
- Smoke test after each deploy:
  1. Sign up, then sign out.
  2. Use "Forgot password?" and confirm the email arrives and the reset works.
  3. Run Lab → simulate → save, then open it in My Observatory.
  4. Check that `/no-such-page` shows the 404 page.

### 3. Backups and recovery

- **Daily backups:** Supabase takes these on paid plans only (Pro and up). The Free plan has none.
- **Point-in-time recovery:** an add-on. Turn it on before inviting real users if losing a day of data is not acceptable.
- **Independent logical backup:** take one periodically, and before every migration:
  ```bash
  pnpm exec supabase db dump --linked -f backup-schema.sql
  pnpm exec supabase db dump --linked --data-only -f backup-data.sql
  ```
  Store it outside Supabase.
- **Restore:** restore into a new project, run `supabase db push` for any newer migrations, then switch the app's environment variables over.

## Project layout

```
src/app            routes (thin server pages that render client components)
src/components     UI by area: lab, explorer, observatory, equipment-3d, ar, auth, ui
src/modules        logic: simulations (engine, renderers), sky, targets, explorer,
                   equipment, configurations, sessions, persistence, lab
supabase/          config.toml, migrations, seed.sql
e2e/               Playwright specs
scripts/           local dev scripts and offline data-fetch scripts
```
