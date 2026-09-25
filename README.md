# Telehealth (demo prototype)

A pnpm + Turborepo monorepo:

| App | Stack | What it does now |
|---|---|---|
| `apps/mobile` | Expo SDK 57, Expo Router, TanStack Query, React Hook Form + Zod, LiveKit | Login page, a main page (top bar, health card, bottom tabs) and a test video call (Mjeku tab). Other tabs are placeholders. UI in Albanian. |
| `apps/api` | NestJS 12, Prisma 7, PostgreSQL, LiveKit server SDK | Basic JWT auth: `register`, `login`, `me`. LiveKit call tokens: `POST /calls/token`. Swagger at `/api/docs`. |

The long-term architecture is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

- Node.js 22+ and pnpm (the version is pinned in `package.json`; `corepack enable` picks it up)
- PostgreSQL running locally (port 5432)
- The Telehealth **development build** on your phone. Expo Go can't run the app because LiveKit needs native code (see [Calls](#calls-livekit-test)).
- A free [LiveKit Cloud](https://cloud.livekit.io) project for calls

## First-time setup

```sh
pnpm install

# API config: copy the example and fill in your Postgres password, a random JWT secret
# and your LiveKit project's URL, API key and secret
cp apps/api/.env.example apps/api/.env

pnpm db:migrate   # creates the "telehealth" database and the users table
pnpm db:seed      # creates the demo user
```

Demo login: **geri** / **1234**

## Running

Use two terminals:

```sh
pnpm dev:api      # API on http://localhost:3000 (Swagger: http://localhost:3000/api/docs)
pnpm dev:mobile   # Expo dev server; open it from the Telehealth development build
```

- The phone must be on the **same network** as this computer. The app automatically calls the API on the computer running the Expo dev server (port 3000). To use a different API, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (see `.env.example`).
- If the phone can't reach the API, allow **Node.js** through the Windows firewall for private networks (port 3000).

## Calls (LiveKit test)

Everyone who taps **Mjeku → Fillo thirrjen** joins the same LiveKit room (`test-call`) with audio and video.

1. **LiveKit keys:** create a project at [cloud.livekit.io](https://cloud.livekit.io) (free plan, no card), then copy the URL, API key and secret into `apps/api/.env`. Restart `pnpm dev:api` after editing `.env`.
2. **Development build** (once, and again whenever a package with native code is added). EAS uploads the git repository, so the repo root must be a git repo first (`git init` at the root). Then:

   ```sh
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest device:create    # iPhone only: registers the phone
   npx eas-cli@latest build --platform ios --profile development
   ```

   An iPhone needs a paid Apple Developer account, and **Developer Mode** turned on (Settings → Privacy & Security). Install the build from the link EAS prints, then run `pnpm dev:mobile` and open the dev server from the app.
3. **Second participant with one phone:** register another user (`POST /api/auth/register` in Swagger), get a token for it from `POST /api/calls/token`, and join from a browser at [meet.livekit.io](https://meet.livekit.io) → **Custom** with the server URL and token. Two participants need different users, because LiveKit disconnects the older connection when the same user joins twice.

## Useful commands

```sh
pnpm typecheck    # typecheck both apps
pnpm build        # build the API
pnpm --filter api prisma:migrate   # after changing apps/api/prisma/schema.prisma
```

## Notes

- The API compiles with plain `tsc` (and `tsc-watch` in dev) instead of the Nest CLI. The Nest 12 CLI crashes on Node 22.13 (`ERR_REQUIRE_CYCLE_MODULE`); after upgrading Node you can switch back to `nest build` / `nest start --watch`.
- The health card's plan, member number and expiry date are sample data (`apps/mobile/src/mock/healthCard.ts`); the holder name comes from the logged-in user.
