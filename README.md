# Telehealth (demo prototype)

A pnpm + Turborepo monorepo:

| App | Stack | What it does now |
|---|---|---|
| `apps/mobile` | Expo SDK 57, Expo Router, TanStack Query, React Hook Form + Zod, LiveKit, expo-callkit-telecom | Login page, a main page (top bar, health card, bottom tabs) and voice/video calls: patients call a doctor from the Mjeku tab, and the doctor's phone rings through CallKit (iOS) or a full-screen notification (Android). Other tabs are placeholders. UI in Albanian. |
| `apps/api` | NestJS 12, Prisma 7, PostgreSQL, LiveKit server SDK | Basic JWT auth: `register`, `login`, `me`. Calls: `/calls` (create, accept, end, …), push tokens: `/devices`, with APNs VoIP and FCM pushes. Swagger at `/api/docs`. |

The long-term architecture is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

- Node.js 22+ and pnpm (the version is pinned in `package.json`; `corepack enable` picks it up)
- PostgreSQL running locally (port 5432)
- The Telehealth **development build** on your phone. Expo Go can't run the app because calls need native code (see [Calls](#calls)).
- A free [LiveKit Cloud](https://cloud.livekit.io) project for calls (see [docs/CALLS_SETUP.md](docs/CALLS_SETUP.md))

## First-time setup

```sh
pnpm install

# API config: copy the example and fill in your Postgres password, a random JWT secret
# and your LiveKit project's URL, API key and secret (plus the optional APNs/FCM keys, see docs/CALLS_SETUP.md)
cp apps/api/.env.example apps/api/.env

pnpm db:migrate   # creates the "telehealth" database and its tables
pnpm db:seed      # creates the demo patient and doctor
```

Demo logins: **geri** / **1234** (patient) and **doktor** / **1234** (doctor)

## Running

Use two terminals:

```sh
pnpm dev:api      # API on http://localhost:3000 (Swagger: http://localhost:3000/api/docs)
pnpm dev:mobile   # Expo dev server; open it from the Telehealth development build
```

- The phone must be on the **same network** as this computer. The app automatically calls the API on the computer running the Expo dev server (port 3000). To use a different API, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (see `.env.example`).
- If the phone can't reach the API, allow **Node.js** through the Windows firewall for private networks (port 3000).

## Calls

Patients call a doctor from **Mjeku → Thirrje zanore / Videothirrje**. The first free doctor's phone rings, even when the app is closed.

Setting up LiveKit, the Apple push key and Firebase is described step by step in [docs/CALLS_SETUP.md](docs/CALLS_SETUP.md). In short:

1. Create a project at [cloud.livekit.io](https://cloud.livekit.io) (free plan, no card; pick the **EU** data region), then copy its URL, API key and secret into `apps/api/.env`. Restart `pnpm dev:api` after editing `.env`.
2. **Development build** (once, and again whenever a package or module with native code changes). EAS uploads the git repository, so the repo root must be a git repo first (`git init` at the root). Then:

   ```sh
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest device:create    # iPhone only: registers the phone
   npx eas-cli@latest build --platform ios --profile development
   npx eas-cli@latest build --platform android --profile development
   ```

   An iPhone needs a paid Apple Developer account, and **Developer Mode** turned on (Settings → Privacy & Security). Install the build from the link EAS prints, then run `pnpm dev:mobile` and open the dev server from the app.
3. **Testing needs two phones:** log in as **doktor** on one and **geri** on the other, then call from geri's phone.

## Useful commands

```sh
pnpm typecheck    # typecheck both apps
pnpm build        # build the API
pnpm --filter api prisma:migrate   # after changing apps/api/prisma/schema.prisma
```

## Notes

- If `corepack enable` / `pnpm` fails with `Cannot find matching keyid`, your corepack is too old to verify pnpm's signature. Update it (`npm install -g corepack@latest`) or run the pinned pnpm directly: `npx pnpm@12.6.0 install`.
- The API compiles with plain `tsc` (and `tsc-watch` in dev) instead of the Nest CLI. The Nest 12 CLI crashes on Node 22.13 (`ERR_REQUIRE_CYCLE_MODULE`); after upgrading Node you can switch back to `nest build` / `nest start --watch`.
- The health card's plan, member number and expiry date are sample data (`apps/mobile/src/mock/healthCard.ts`); the holder name comes from the logged-in user.
