# Calls setup (LiveKit)

This guide covers setting up the patient → doctor voice and video calls: the LiveKit project, the Apple and Firebase keys that make the doctor's phone ring, and how to test.

## How a call works

1. The patient taps the big **Thirr** button (video, or voice only). The patient doesn't choose the doctor. The API (`POST /api/calls`):
   - checks the patient has an active subscription and isn't blocked;
   - creates the call in the **queue** (`QUEUED`) and gives the patient a LiveKit token for the call's own room (`call-<id>`);
   - rings the first free doctor right away if there is one (`RINGING`).

   The patient's app shows the call on the phone's call screen (with a dial tone), joins the room and waits there. The waiting screen shows "N people ahead", "Calling…" or "Trying another line…".
2. The API rings the doctor's phone:
   - **iPhone:** a VoIP push, which iOS shows as a normal incoming call through CallKit, even when the app is closed or the phone is locked.
   - **Android:** a high-priority FCM message, which the phone shows as a full-screen incoming call with Answer and Decline.
   - The app's `expo-callkit-telecom` module reads both pushes natively, before the app's JavaScript is running.
   - Pushes contain only ids, so a ring from a push says **Pacient**. While the doctor's app is open, a full-screen invitation also shows the patient's name, plan and its dates, with Answer and Hang up.
   - While the doctor's app is open, it also checks for ringing calls every 3 seconds, so it rings without push too. That check also marks the doctor as reachable.
   - The phone stops ringing after 40 seconds; the API gives up on that doctor after 45, since the push arrives a little after the ring starts.
3. **A doctor who doesn't answer or declines passes the call on:** it goes back to the queue and the next free doctor is rung ("Trying another line…"). The call ends as `UNANSWERED` ("lines busy") when every reachable doctor has been tried, or after `CALL_MAX_WAIT_SECONDS` (5 minutes) in total.
   - A doctor is **reachable** when they have a push device, or their app checked for calls in the last 30 seconds. A patient calling when no doctor is reachable gets "lines busy" right away.
   - There are no background jobs: the queue moves when call requests arrive, and the waiting patient's app asks every 2 seconds.
4. The doctor answers. The app opens the call, the API (`POST /api/calls/:id/accept`) gives the doctor a token for the same room, and the doctor's app joins it.
5. During the call the doctor can **Add doctor**: a list of free doctors, and the chosen one is rung the same way (`POST /api/calls/:id/invites`). An added doctor who hangs up only leaves.
6. The patient or the answering doctor hangs up, in the app or on the phone's call screen (`POST /api/calls/:id/end`). The API deletes the room, which ends the call for everyone. The patient can then rate the call.

The app uses:

- the LiveKit React Native SDK (`@livekit/react-native`) for audio and video;
- [`expo-callkit-telecom`](https://github.com/mfairley/expo-callkit-telecom) for the phone's call screen: CallKit + PushKit on iOS, Core-Telecom + FCM on Android. It also owns the phone's audio session, so the app never starts LiveKit's own `AudioSession`.

## 1. LiveKit Cloud

1. Go to <https://cloud.livekit.io> and sign up. The free **Build** plan needs no card.
2. **Create a project.** Choose the data region **European Union (Frankfurt)**.
   - The data region **can't be changed later**. If you pick the wrong one, create a new project.
   - It decides where LiveKit stores analytics and logs. Call media still takes the shortest route and isn't stored; keeping media on EU servers only (region pinning) needs the Scale plan.
3. Open the project → **Settings → API keys** and create a key. Put the project URL, the key and the secret in `apps/api/.env`:
   ```
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   ```
   - The secret can create tokens for any room: never commit it and never put it in the app. If it leaks, delete the key in LiveKit and create a new one.
   - Tokens carry only the user's id, not their name, and last 10 minutes.
4. The free plan includes 5,000 participant-minutes a month. A two-person call uses 2 per minute.

**Self-hosting later:** the same app works with a LiveKit server you run yourself, for example in Albania. Point the three variables at your server; the app doesn't change, because the API sends it the server URL with every call.

## 2. iPhone ringing: APNs VoIP key (Apple Developer)

This needs the paid Apple Developer account you use for EAS builds.

1. Go to <https://developer.apple.com/account> → **Membership details** and copy your **Team ID**.
2. Go to **Certificates, Identifiers & Profiles → Keys → +**:
   - Name: `Telehealth APNs`. Tick **Apple Push Notifications service (APNs)** → **Configure**:
     - Environment: **Sandbox & Production**.
     - Key restriction: **Team Scoped (All Topics)**.
   - **Continue → Register → Download**. The `.p8` file can only be downloaded once. Note the **Key ID**.
3. Put the file in `apps/api/secrets/` (git ignores this folder). Then set these in `apps/api/.env`:
   ```
   APNS_KEY_PATH=./secrets/AuthKey_XXXXXXXXXX.p8
   APNS_KEY_ID=XXXXXXXXXX
   APNS_TEAM_ID=YYYYYYYYYY
   APNS_BUNDLE_ID=al.telehealth.app
   APNS_PRODUCTION=false
   ```
   Use `APNS_PRODUCTION=false` for development builds, and `true` for TestFlight and App Store builds.
4. You don't need to create the App ID or turn on Push Notifications yourself. The `expo-callkit-telecom` config plugin adds the `aps-environment` entitlement, and EAS turns on the capability when it builds.

## 3. Android ringing: Firebase Cloud Messaging

1. Go to <https://console.firebase.google.com> → **Add project** (Analytics can stay off).
2. **Add app → Android**. Package name: `al.telehealth.app`.
   - Download **google-services.json** and put it in `apps/mobile/google-services.json`.
   - **Android builds need this file.** `expo-callkit-telecom` registers for FCM when the app starts, and the app would crash without Firebase, so a build without the file stops with an error instead. iOS builds don't use it.
   - The file isn't secret, so commit it: EAS only uploads files that are in git.
   - Alternatively, create an EAS environment variable of type *file* named `GOOGLE_SERVICES_JSON`.
3. Go to **Project settings → Service accounts → Generate new private key**.
   - Save the JSON as `apps/api/secrets/firebase-service-account.json`.
   - Set `FCM_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json` in `apps/api/.env`.
   - This file *is* a secret.
4. **Firebase Cloud Messaging API (V1)** is on by default for new projects. You can check it under **Project settings → Cloud Messaging**.

## 4. Build and test

```sh
pnpm install
pnpm db:migrate    # the whole app's tables, including the call queue
pnpm db:seed       # demo accounts and content; re-running it resets the demo data
pnpm dev:api
```

The app has new native code (LiveKit, `expo-callkit-telecom`, `expo-notifications`), so **make a new development build**. Builds from before this change won't work:

```sh
cd apps/mobile
npx eas-cli@latest build --platform ios --profile development
npx eas-cli@latest build --platform android --profile development
```

You need **two phones**:

1. On phone A, log in as **doktor@telehealth.al / 1234** and allow the microphone, camera and notifications.
   - If this phone was already logged in with an older build, log out and in once. The app now saves the login so it can be read on the lock screen, which a doctor needs to answer there.
2. On phone B, log in as **geri@telehealth.al / 1234** (it has an active subscription), then tap the **Thirr** tab and the big button.
3. Phone A rings. Answer it, and you're in the call.
4. Try it with phone A's app closed and the screen locked. This only works once the APNs/FCM keys above are set.

Without the APNs key or the FCM service account on the API, the doctor's phone still rings while the Telehealth app is open.

### Testing on an iPhone without a paid Apple account

You can build on your Mac with a free Apple ID. The doctor's iPhone then rings only while the Telehealth app is open, because push notifications need the paid Apple Developer Program.

1. Install Xcode and sign in with your Apple ID under **Xcode → Settings → Apple Accounts**.
2. Connect the iPhone by cable, unlock it and tap **Trust**. Turn on **Settings → Privacy & Security → Developer Mode**.
3. Build and install:
   ```sh
   cd apps/mobile
   FREE_APPLE_ID=1 npx expo run:ios --device
   ```
   - Pick the iPhone, and the signing certificate of your own Apple ID (Personal Team).
   - `FREE_APPLE_ID=1` leaves out the push entitlement, which a free Apple ID can't sign. It also uses the bundle ID `al.telehealth.app.test`, because a bundle ID can't move to another Apple team later and `al.telehealth.app` must stay free for the paid account.
   - This also starts the dev server, so stop `pnpm dev:mobile` first if it's running.
4. The first time, iOS won't open the app: go to **Settings → General → VPN & Device Management**, tap your Apple ID and **Trust**.
5. Apps signed with a free Apple ID stop opening after 7 days. Run the command again to reinstall.

With only one iPhone, call it as the patient from the Mac:

1. Open `http://localhost:3000/api/docs`, call `POST /api/auth/login` with `{"email":"geri@telehealth.al","password":"1234"}`, and paste the `accessToken` under **Authorize**. (Or run `node apps/api/scripts/test-call.mjs`, which does steps 1–3.)
2. Call `POST /api/calls` with `{"media":"VIDEO"}`.
3. Open <https://meet.livekit.io>, choose **Custom**, and paste `join.serverUrl` and `join.token` from the response. The browser is now the patient.
4. The iPhone, open on the doctor's account, rings within a few seconds. Answer it.

## Not done yet

- **Calls have not been tested on a real phone yet.** Both apps typecheck and `expo prebuild` succeeds, but expect a few fixes on the first build.
  - `expo-callkit-telecom` is young (version 0.5.0, one maintainer). Its example app runs on the same Expo 57 and React Native 0.86.3.
  - On iOS it ships its own copy of WebRTC, separate from LiveKit's (a bigger app). The app links the two through the audio session: LiveKit's audio engine stays off until CallKit activates the call's audio (`src/calls/audio-engine.ts`, the pattern from LiveKit's CallKit example). Check first on a real iPhone that both sides hear each other, also when answering on the lock screen.
- **A patient who hangs up while the doctor's phone rings:** if the doctor's app isn't running, the phone keeps ringing until its 40-second timeout. When the app is running, it stops the ringing within 2 seconds.
- **Calling again right after hanging up:** for 45 seconds after a patient cancels, that doctor counts as busy, because a closed app can still be ringing for the old call and the phone ignores a second ring. With one reachable doctor, the new call waits in the queue until then.
- **Timeouts that must agree:** `outgoingCallTimeout` (360 s, `app.json`) must stay longer than `CALL_MAX_WAIT_SECONDS` + `CALL_RING_SECONDS` (300 + 45), or the patient's phone ends a call that is still waiting in the queue. `incomingCallTimeout` (40 s) must stay a few seconds shorter than `CALL_RING_SECONDS`.
- **A doctor who declines before the app is running** (Android with the app closed, or iOS while the app is still starting): the patient hears the dial tone until the 45 seconds are up. Telling the API right away needs a small native receiver (`androidEventReceiver` in `expo-callkit-telecom`) on Android.
- **Choosing a doctor:** the first free, reachable doctor (one with a push device first). "Call now" after a doctor's **Free line**, and "Request a call" in a live activity, ring that doctor first. Personal doctors, care teams and shifts come later (see ARCHITECTURE.md).
- **Keeping call state in step:** the apps poll the API every 2–3 seconds. Socket.IO, LiveKit webhooks and the sweeper job from the architecture come later.
- **Network drops:** LiveKit reconnects by itself after short drops (for example Wi-Fi to mobile data), and the call waits up to 15 seconds for the other side to come back. If a phone stays offline longer, the call ends.
- **Phone numbers:** calling a regular phone number isn't built yet. The next step is LiveKit SIP with a SIP trunk that reaches +355 numbers.
