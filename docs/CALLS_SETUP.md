# Calls setup (Azure Communication Services)

This guide covers setting up the patient → doctor voice and video calls: the Azure resource, the Apple and Firebase keys that make the doctor's phone ring, and how to test.

## How a call works

1. The patient taps **Mjeku → Thirrje zanore** or **Videothirrje**. The API (`POST /api/calls`):
   - picks a free doctor;
   - creates an ACS **Room** with only the patient in it;
   - gives the patient an ACS token, and the patient's app joins the room and waits.
2. The API rings the doctor's phone:
   - **iPhone:** a VoIP push, which iOS shows as a normal incoming call through CallKit, even when the app is closed or the phone is locked.
   - **Android:** a high-priority FCM message, which the app shows as a full-screen ringing notification with Answer and Decline.
   - While the doctor's app is open, it also checks for ringing calls every 3 seconds, so it rings without push.
3. The doctor answers (`POST /api/calls/:id/accept`). The API adds the doctor to the room, and the doctor's app joins it.
4. Either side hangs up (`POST /api/calls/:id/end`). The API deletes the room, which ends the call for both sides.
   - A call nobody answers within 45 seconds becomes `UNANSWERED`.

Pushes contain only the call id; the phone looks up the patient's name from the API.

The app talks to ACS through our own Expo module, `apps/mobile/modules/acs-calling`, because ACS has no React Native SDK. It wraps:

- the ACS iOS SDK (`AzureCommunicationCalling` 2.15), with CallKit and PushKit;
- the ACS Android SDK (`azure-communication-calling` 3.0.0), with FCM.

## 1. Azure Communication Services (Azure portal)

You need an Azure subscription. The free account works, but it asks for a card.

1. Go to <https://portal.azure.com> and sign in.
2. **Create a resource group** (a folder for everything this project uses):
   - Search **Resource groups** at the top → **+ Create**.
   - Subscription: yours. Name: `rg-telehealth-dev`. Region: **(Europe) Italy North** or **West Europe**. This region only says where the group's metadata is stored.
   - **Review + create → Create**.
3. **Create the Communication Services resource:**
   - Search **Communication Services** at the top → **+ Create**.
   - **Subscription:** yours. **Resource group:** `rg-telehealth-dev`.
   - **Resource name:** for example `acs-telehealth-dev`. It must be unique across Azure and becomes part of the endpoint URL.
   - **Data location:** **Europe**. This decides where ACS stores data at rest, and **it can't be changed later**. If you pick the wrong one, you must create a new resource.
   - Tags: optional. **Review + create → Create.** It takes a minute or two.
4. **Copy the connection string:**
   - Open the new resource. In the left menu, go to **Settings → Keys**.
   - Copy **Primary key → Connection string**. It looks like `endpoint=https://acs-telehealth-dev.europe.communication.azure.com/;accesskey=...`.
   - Put it in `apps/api/.env`:
     ```
     ACS_CONNECTION_STRING=endpoint=https://...;accesskey=...
     ```
   - This string is a full-access secret: never commit it and never put it in the app. If it leaks, go to **Keys** and **Regenerate** the key.
5. **Rooms** need no extra setup: every Communication Services resource supports them.
6. **Recommended:** set a spending limit alert.
   - Go to **Cost Management + Billing → Budgets** and add a monthly budget with an email alert.
   - Calls are billed per participant per minute. See the Azure Communication Services pricing page.
7. **Optional check:**
   - In the resource, open **Identities & User Access Tokens**.
   - Tick **Voice and video calling (VOIP)** and click **Generate**.
   - If you get an identity and a token, the resource works.

Later, not needed for testing:

- one resource per environment (`acs-telehealth-prod` for production);
- the connection string in Key Vault;
- an **Events → Event Grid** subscription for call events;
- **Diagnostic settings** to send call logs to Log Analytics.

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
4. You don't need to create the App ID or turn on Push Notifications yourself. The app declares the `aps-environment` entitlement in `app.json`, and EAS turns on the capability when it builds.

## 3. Android ringing: Firebase Cloud Messaging

1. Go to <https://console.firebase.google.com> → **Add project** (Analytics can stay off).
2. **Add app → Android**. Package name: `al.telehealth.app`.
   - Download **google-services.json** and put it in `apps/mobile/google-services.json`.
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
pnpm db:migrate    # adds roles, devices and calls
pnpm db:seed       # adds the demo doctor: doktor / 1234 (the patient is geri / 1234)
pnpm dev:api
```

The app has new native code, so **make a new development build** (the old LiveKit build won't work):

```sh
cd apps/mobile
npx eas-cli@latest build --platform ios --profile development
npx eas-cli@latest build --platform android --profile development
```

You need **two phones**:

1. On phone A, log in as **doktor / 1234** and allow the microphone, camera and notifications.
2. On phone B, log in as **geri / 1234**, then go to **Mjeku → Videothirrje**.
3. Phone A rings. Answer it, and you're in the call.
4. Try it with phone A's app closed and the screen locked. This only works once the APNs/FCM keys above are set.

Without the APNs or FCM keys, the doctor's phone still rings while the Telehealth app is open.

## Not done yet

- **Calls have not been tested on a real phone yet.** The native module was written against the ACS SDKs' public APIs and Microsoft's samples. It hasn't been compiled here, so expect a few fixes on the first build.
- **Choosing a doctor:** the first free doctor. Personal doctors, care teams and shifts come later (see ARCHITECTURE.md).
- **Keeping call state in step with ACS:** the apps poll the API every 2–3 seconds. Socket.IO, Event Grid webhooks and the sweeper job from the architecture come later.
- **No reconnect:** if a phone loses the network long enough to drop out of the room, the call ends.
