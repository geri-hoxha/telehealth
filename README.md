# Telehealth (demo prototype)

A pnpm + Turborepo monorepo:

| App | Stack | What it does now |
|---|---|---|
| `apps/mobile` | Expo SDK 57, Expo Router, TanStack Query, React Hook Form + Zod, LiveKit, expo-callkit-telecom | One app for patients and doctors, in Albanian, English and Macedonian. Patients: home (stories, health card, benefits, articles), activities, a one-button call to the first free doctor (queue, retries), medical folders, subscription. Doctors: incoming-call invitation, add a doctor to a call, call history with "Free line", patients with folders and temporary blocks. |
| `apps/api` | NestJS 12, Prisma 7, PostgreSQL, LiveKit server SDK | Auth (email, sign-up with email confirmation, reset codes, biometric keys), calls with a queue, push (APNs VoIP + alerts, FCM), medical folders with comments and documents, events, notifications, subscriptions and claims, content. Swagger at `/api/docs`. |

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
pnpm db:seed      # demo accounts and content (re-running it resets the demo data)
```

Demo logins (password **1234** for all):

| Email | Role | Notes |
|---|---|---|
| `patient@telehealth.al` | patient | Active Premium subscription, folders, claims, call history |
| `arta@telehealth.al` | patient | No subscription, to try "My registration" |
| `elton@telehealth.al` | patient | Blocked from calling for 2 days |
| `doktor@telehealth.al` | doctor | Arben Mjeku; specialist of the live activity |
| `drita@`, `besnik@`, `elena@telehealth.al` | doctors | For "Add doctor" and the queue |

To activate a subscription in the app: insurance **Shëndetësore 4021883011230059** or **Familjare 5100200030004000**, or the prepaid codes **TH-30-DEMO**, **TH-90-DEMO**.

Emails (sign-up confirmation links, password reset codes) are written to the API's log until `RESEND_API_KEY` is set.

## Running

Use two terminals:

```sh
pnpm dev:api      # API on http://localhost:3000 (Swagger: http://localhost:3000/api/docs)
pnpm dev:mobile   # Expo dev server; open it from the Telehealth development build
```

- The phone must be on the **same network** as this computer. The app automatically calls the API on the computer running the Expo dev server (port 3000). To use a different API, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (see `.env.example`).
- If the phone can't reach the API, allow **Node.js** through the Windows firewall for private networks (port 3000).

## Calls

Patients call from the big **Thirr** button. The call waits in a queue and rings the first free doctor; if they don't answer, it tries the next one. The doctor's phone rings even when the app is closed (with push set up).

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
3. **Testing needs two phones:** log in as **doktor@telehealth.al** on one and **patient@telehealth.al** on the other, then call from the patient's phone. With one phone, see "Testing on an iPhone without a paid Apple account" in [docs/CALLS_SETUP.md](docs/CALLS_SETUP.md).

## Useful commands

```sh
pnpm typecheck    # typecheck both apps
pnpm build        # build the API
pnpm --filter api prisma:migrate   # after changing apps/api/prisma/schema.prisma
```

## Notes

- If `corepack enable` / `pnpm` fails with `Cannot find matching keyid`, your corepack is too old to verify pnpm's signature. Update it (`npm install -g corepack@latest`) or run the pinned pnpm directly: `npx pnpm@12.6.0 install`.
- The API compiles with plain `tsc` (and `tsc-watch` in dev) instead of the Nest CLI. The Nest 12 CLI crashes on Node 22.13 (`ERR_REQUIRE_CYCLE_MODULE`); after upgrading Node you can switch back to `nest build` / `nest start --watch`.
- The partner clinic network page and the seeded policies, codes, stories, benefits, articles and activities are sample data until an admin web exists.
