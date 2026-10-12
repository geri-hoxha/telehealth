# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A demo prototype of an Albanian telehealth app (a Teleshëndet-style service: patients call a doctor by audio/video), in a pnpm + Turborepo monorepo:

- `apps/api`: NestJS 12, Prisma 7 + PostgreSQL, LiveKit server SDK. Auth, calls with a queue, push, medical folders, events, notifications, subscriptions, content.
- `apps/mobile`: Expo SDK 57 (React Native 0.86, new architecture), Expo Router, TanStack Query, LiveKit, `expo-callkit-telecom`. One app for patients (role `PATIENT`, the "client") and doctors (`DOCTOR`), in Albanian (default), English and Macedonian.

`docs/ARCHITECTURE.md` is the long-term target (much of it isn't built yet). `docs/CALLS_SETUP.md` covers LiveKit, APNs and FCM setup, how the call queue works and the known limits of calls. `apps/mobile/AGENTS.md` (loaded by `apps/mobile/CLAUDE.md`) has the Expo rules: check the versioned Expo docs before touching Expo APIs, use `npx expo install`, never edit generated `ios/`/`android/`.

## Commands

pnpm is pinned (`packageManager: pnpm@12.6.0`). If `pnpm`/corepack fails with `Cannot find matching keyid`, run it as `npx pnpm@12.6.0 <args>` (also `npx expo install` fails with `spawn pnpm ENOENT`: run the `pnpm add` it prints through `npx pnpm@12.6.0`).

```sh
pnpm install                       # also runs `prisma generate` for the API
pnpm dev:api                       # API on :3000, Swagger at /api/docs (tsc-watch, not the Nest CLI)
pnpm dev:mobile                    # Expo dev server; needs the Telehealth development build (not Expo Go)
pnpm typecheck                     # both apps; one app: pnpm --filter api typecheck / --filter mobile typecheck
pnpm build                         # builds the API with tsc
pnpm db:migrate                    # prisma migrate dev (needs Postgres and apps/api/.env)
pnpm db:seed                       # demo data; resets everything but accounts and phones
```

- Demo logins (password `1234`): `patient@telehealth.al` (patient, active subscription), `arta@` (no subscription), `elton@` (blocked), `doktor@telehealth.al` (doctor), `drita@`, `besnik@`, `elena@` (doctors).
- There are no tests and no linter config. `npx expo lint` would try to install ESLint and create a config, so don't run it unless asked to set up linting. `CI=1 npx expo export --platform ios --platform android --output-dir <tmp>` bundles the app and catches import errors that `tsc` misses.
- After changing `apps/api/prisma/schema.prisma`: `pnpm --filter api prisma:migrate`. Without a database, `npx prisma migrate diff --from-schema <old> --to-schema prisma/schema.prisma --script` generates the SQL. A new enum value needs its own migration before one that uses it (Postgres can't use a value added in the same transaction). The Prisma client is generated into `apps/api/src/generated/prisma` (gitignored).
- The API compiles with plain `tsc` because the Nest 12 CLI crashes on Node 22.13.
- Native code changes need a new development build: `cd apps/mobile && npx eas-cli@latest build --platform ios --profile development` (needs the paid Apple Developer Program). There is no paid Apple account of our own yet, so iPhone testing signs with SIGAL's paid team: `SIGAL_TEAM=1 npx expo run:ios --device` (bundle ID `al.telehealth.app.sigal`), with push through an APNs key from that team (`apps/api/secrets/`, gitignored). A free Apple ID also works: `FREE_APPLE_ID=1 npx expo run:ios --device` (bundle ID `al.telehealth.app.test`, stops opening after 7 days); `app.config.ts` then drops the push entitlement and sets `extra.pushNotifications: false`, so the phone rings and gets notifications only while the app is open. Switching between them needs `npx expo prebuild --platform ios --clean` with the same variable first, because `expo run:ios` keeps an existing `ios/`. To check config plugins without building, run `npx expo prebuild --no-install` on a copy of `apps/mobile` inside `apps/` (it needs the hoisted `node_modules`; Android needs a `google-services.json`, a dummy one is fine for the check).
- iOS 27 (Xcode 27) traps at launch unless the app uses the UIScene life cycle: `expo-build-properties` → `ios.enableSceneSupport: true` in `app.json` does that for SDK 57. Remove it when upgrading to SDK 58.
- In dev, the app calls the API on the Expo dev server's host at port 3000 (`src/api/client.ts`), so the phone must be on the same network; `EXPO_PUBLIC_API_URL` overrides it.
- Emails (sign-up confirmation links, password reset codes) are only written to the API log until `RESEND_API_KEY` and `MAIL_FROM` are set.

## API architecture (`apps/api/src`)

- Global prefix `/api`, a global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`, and Swagger built from DTO decorators. Protected controllers use `@UseGuards(JwtAuthGuard)` and get the user via `@CurrentUserId()`. Shared services live in global modules (Prisma, Users, Auth, Mail, Files, Push, Notifications, Subscriptions, Care), so feature modules don't import them.
- Errors that the app reacts to are `ApiException`s (`common/api-exception.ts`) with a stable `code` (e.g. `SUBSCRIPTION_REQUIRED`, `PATIENT_BLOCKED`, `EVENT_FULL`, `NO_DOCTOR_AVAILABLE`). The app translates `error.<CODE>` keys (`api/errors.ts`); call codes are mapped in `calls/useCall.ts`.
- **Language:** the app sends `Accept-Language: sq|en|mk`; `@RequestLanguage()` reads it. Content (stories, benefits, articles, events) is stored as `{"sq","en","mk"}` JSON and localized by `localize()`. Notifications store a type + params and are rendered per language by `notifications/templates.ts` (also for push texts, in the user's saved `language`).
- **Who sees what:** patients see their own records. A doctor sees a patient only after answering their call, being added to it, or writing them a folder (`care/care.service.ts`); anything else is a 404. Patients need an active subscription for calls, joining events and comments (`SubscriptionsService.requireActive`).
- **Calls** (`calls/calls.service.ts`) are a queue and a state machine: `QUEUED → RINGING → ACCEPTED → ENDED`; a ring nobody answers or a decline goes back to `QUEUED` and the next free doctor is tried (each ring is a `CallAttempt`); `QUEUED | RINGING → CANCELED | UNANSWERED`; any → `FAILED`.
  - There are no background jobs: `refresh()` (expire, then dispatch) runs at the start of call requests, one run at a time. The waiting patient's 2-second poll keeps the queue moving.
  - Only *reachable* doctors are rung: a push device, or `lastSeenAt` within 30 s (set by the open app's `/calls/incoming` poll). The call ends `UNANSWERED` ("lines busy") once every reachable doctor was tried or after `CALL_MAX_WAIT_SECONDS`.
  - State changes are conditional `updateMany`s on the current state, so concurrent requests can't both win. "One active call per patient / per doctor" and "one active invite per doctor" are partial unique indexes written by hand in the migration SQL (Prisma can't express them).
  - A doctor whose ring the patient cancelled stays busy for `CALL_RING_SECONDS`, because a closed app may still be ringing and the phone drops a second ring.
  - "Add doctor" is a `CallInvite` rung like a call; an added doctor who hangs up only leaves. `preferredDoctorId` ("Call now" after a free line) and `eventId` (a live event's specialist) are rung first.
  - The `CallDto` is per viewer: `ringingForMe` tells a doctor's phone whether to keep ringing, `queuePosition` and `patientPlan` are filled in `detail()`.
- **Media**: each call has its own LiveKit room named `call-<id>` (`livekit/livekit.service.ts`). The patient gets a token on create, a doctor only on accept; tokens carry only the user id (no names) and last 10 minutes. Ending a call deletes the room, which disconnects everyone. The same code works with LiveKit Cloud or a self-hosted server via `LIVEKIT_URL/KEY/SECRET`.
- **Push** (`push/`): hand-written APNs (HTTP/2, `.p8` token auth) and FCM HTTP v1 clients. Call rings must match `expo-callkit-telecom`'s `IncomingCallEvent`, which the phone parses natively: APNs body `{ incomingCall: {...} }`, FCM data `{ messageType: 'incomingCall', incomingCall: '<json>' }`; `eventId` is the ring's id (attempt or invite). Device kinds: `VOIP` (iOS calls), `APNS` (iOS notifications, data under `body` for expo-notifications), `FCM` (Android, both). Pushes carry only ids; the caller shows as "Pacient". There is no cancel push, since iOS forbids VoIP pushes that don't ring. Missing credentials only log a warning.
- **Files** (`files/`): uploads go to `UPLOADS_DIR` under random UUID names. Avatars are public (`/api/files/avatars/<name>`); folder documents need the token (`/api/documents/:id/file`).
- **Lab results** (`lab-reports/`): a `LabReport` (BLOOD or URINE, when it was taken, the lab) holds `LabResult`s, each with the lab's reference `ranges` (`[{ to, status }]` from the low end, `to: null` = no end, status LOW/NORMAL/BORDERLINE/HIGH) and the `scaleMin`/`scaleMax` the app draws. The server works out each result's `status` (a value on a boundary belongs to the range above); names are `{"sq","en","mk"}` JSON like content. `GET /api/lab-reports/latest` returns the patient's newest report of each type. Patients only read them (labs would write them): the demo data is `prisma/lab-reports.seed.ts`, which the seed calls.
- Timing that must agree: `CALL_RING_SECONDS` (45) a few seconds longer than `incomingCallTimeout` (40, `app.json`); `outgoingCallTimeout` (360) longer than `CALL_MAX_WAIT_SECONDS` + `CALL_RING_SECONDS`.

## Mobile architecture (`apps/mobile/src`)

- **Routes** (`src/app`, Expo Router): `index` redirects by state to `language` (first launch), `(auth)/welcome` (email step → `password` or `sign-up`; `forgot-password`, `reset-password`, `sign-up-done`), `patient/` tabs (home, activities, call, folders, profile) or `doctor/` tabs (home, calls, patients, profile). Other screens are flat routes guarded in `_layout.tsx` with `Stack.Protected` per role (e.g. `events/[id]`, `subscription`, `health-card`, `lab-results` for patients; `patients/[id]`, `incoming`, `add-doctor` for doctors; `call`, `folders/[id]`, `calls/[id]`, `notifications`, `settings` for both).
- **i18n** (`src/i18n`): flat dictionaries; `sq.ts` is the source of keys and `en.ts`/`mk.ts` are typed against it, so a missing key fails `tsc`. `t(key, params)`, `tp(key, count)` for `_one`/`_other` plurals (Macedonian rules included). Dates are formatted by hand in `i18n/format.ts`. Every user-facing string goes through `t`.
- **Design system**: tokens in `theme.ts` (teal brand, accents for content, type scale, shadows); primitives in `components/ui` (`AppText`, `Button`, `Card`, `Screen`, `Header`, `TextField`, `ListGroup`/`ListRow`, `Badge`, `Sheet` + `useActionSheet`, `useSnackbar`, states/skeletons). Use them instead of raw styles.
- **Data**: `api/client.ts` holds the session token (`apiSession`) and sends the language header; endpoint functions are in `api/auth.ts`, `api/calls.ts`, `api/records.ts`; queries and keys in `api/queries.ts`. Sign-out clears the query cache. The JWT is in SecureStore with `AFTER_FIRST_UNLOCK`, so the app can call the API after a doctor answers on the lock screen. Biometric login keeps an API-issued key behind `requireAuthentication` (`auth/biometrics.ts`).
- **Lab results** (`app/lab-results.tsx`, linked from the patient home): `components/LabResultCard.tsx` draws a value on a row of dots coloured by the lab's ranges, and `utils/lab.ts` repeats the server's status rule to colour them. The health card (`components/HealthCard.tsx`) is gold; its 3D look is layered gradients, borders and shadows plus a tilt toward the finger from plain touch events, which don't take the touch from the `Pressable` around it.
- Calls are split in three:
  - `calls/CallCoordinator.tsx`, rendered once next to the navigator. It registers the push token (`/devices`), shows the in-app invitation (`/incoming`) while the app is open, opens `/call` when a call is answered (replacing the invitation), sends `/decline` when declined, stops the ringing when `ringingForMe` turns false, and lets a doctor's open app ring by polling `/calls/incoming` (one report per `ringId`).
  - `calls/useCall.ts` runs one call: API create/accept → the `expo-callkit-telecom` session (`startOutgoingCall` / `fulfillIncomingCallConnected`) → a LiveKit `Room`. Phases follow the server state (`waiting`/`ringing`/`connecting`), and it ends the call exactly once (`finish`) with an `EndReason` the screen translates.
  - `app/call.tsx` renders the waiting screen, the room (tiles per remote participant via `useRemoteParticipants`/`useTracks`/`VideoTrack`) and the end screen (rating, "lines busy", try again).
- **Audio rules (easy to break):** `expo-callkit-telecom` owns the audio session (CallKit on iOS, Core-Telecom on Android).
  - Never call LiveKit's `AudioSession.startAudioSession()`/`stopAudioSession()`; `registerGlobals({ autoConfigureAudioSession: false })` in `_layout.tsx` is intentional.
  - On iOS that library links a separate WebRTC build, so `calls/audio-engine.ts` switches LiveKit's audio engine on and off with CallKit's audio-session events.
  - Mute and speaker go through the library (`setMuted`, `setAudioSessionPortOverride`), and LiveKit follows its events. The in-app Answer/Hang up call `answerCall`/`endCall`, so they take the same path as the system screen.
- **Notifications** (`notifications/NotificationCenter.tsx`): foreground pushes show a snackbar with "Show" instead of a banner; the open app also polls `/notifications/unread` so notifications appear without push. On Android, `expo-callkit-telecom`'s FCM service forwards non-call messages to `expo-notifications`.
- Android builds require `apps/mobile/google-services.json` (`app.config.ts`): the library registers for FCM at startup and would crash without Firebase, so the build fails instead. Don't set `microphonePermission: false` on `expo-image-picker`: it blocks Android's `RECORD_AUDIO`, which calls need.

## Repo conventions

- The root `.gitignore` deliberately doesn't ignore `ios/`/`android/`; `apps/mobile/.gitignore` ignores only its generated `/ios` and `/android`. Native code inside a local Expo module must be committed.
- Calls used to run on Azure Communication Services. That was removed because ACS is retiring as a standalone service (Sept 2028) and has no React Native SDK; don't reintroduce it.
- Code comments and docs are plain, short sentences explaining why. User-facing strings go through the i18n dictionaries (Albanian first); server-made texts (notifications, emails, pages) exist in all three languages.
