# Telehealth: Target Architecture

> The long-term plan. The current code is only a demo prototype (login, home screen and patient → doctor calls). Build towards this in phases.

## 1. Product and decisions

Insured clients call their **personal doctor 24/7** by audio or video. What each client can use depends on **their insurance policy and its coverages**.

| Topic | Decision |
|---|---|
| Market | Albania only. Albanian and English, time zone Europe/Tirane, money in ALL, EUR, … |
| Data location | Stored personal and medical data stays in Albania |
| What decides access | The **policy's coverages** (there are no separate tiers) |
| Policy data | **Entered in our admin web**, which is the master copy |
| How calls use coverage | Only **the number of calls is counted**; money limits are shown, not deducted |
| Calls | **LiveKit** (open source), one room per call: LiveKit Cloud (EU) for now, self-hosted in Albania if media must stay in the country |
| Doctors | Use their **phones only**; one app for both patients and doctors |
| Insurers | One (the `Insurer` table exists so more can be added) |
| 24/7 model | Not decided yet, so routing is configurable |

**Users:** patients (policy beneficiaries), doctors, insurer staff (admin web).

**Main idea:** no single doctor can be on call 24/7. A call rings the **personal doctor** first, then **doctors on call** in the same care team, then turns into a **callback request**. The patient's coverages decide which of these steps they get.

## 2. System overview

```
Expo app (patient + doctor) ──REST──► NestJS modular monolith ──► PostgreSQL (Prisma)
        ▲   ◄──Socket.IO events──        │  BullMQ jobs          Redis (presence, queues, WS adapter)
        │                                  ├─► LiveKit: room tokens, room API ◄── LiveKit webhooks
        │ VoIP push (APNs) / FCM ◄────────┘
        └──── media ────► LiveKit (Cloud EU, or self-hosted in Albania)
Admin web (Vite + React) ──REST──► same API (/admin/*)
```

- **Control plane:** our API decides everything: call state, routing and eligibility.
- **Media:** one LiveKit room per call. Apps join with LiveKit tokens that our backend issues. The app works the same with LiveKit Cloud and a self-hosted LiveKit server; only the API's settings change.
- **Wake-up:** APNs VoIP pushes (iOS) and high-priority FCM data messages (Android) bring up the phone's native call screen through `expo-callkit-telecom` (CallKit / Core-Telecom). Payloads contain only IDs.
- **No microservices, no Kubernetes.** BullMQ workers run in the API process until load requires splitting them out.

## 3. Target monorepo

```
apps/
  mobile/     Expo + expo-router · (auth) (patient) (doctor) route groups · LiveKit + expo-callkit-telecom
  api/        NestJS · src/{common,config,infra,modules} · prisma/
  admin/      Vite + React + TanStack Router/Query/Table + RHF + Zod + Mantine
packages/
  contracts/  Zod schemas, enums, Money type, Albanian format validators (NID, NIPT, +355), error codes, WS events
  api-client/ Orval-generated fetch client + TanStack Query hooks (from the API's OpenAPI spec)
  tsconfig/ · eslint-config/
```

Rules:
- The apps never import Prisma. Enums live in `contracts`, and a test checks they match Prisma's.
- Money is sent as decimal strings with a currency code.

## 4. Backend modules (NestJS)

| Module | Responsibility |
|---|---|
| auth | Activation (NID + date of birth → SMS code), login, rotating refresh tokens, invites, TOTP for staff and doctors |
| users | Accounts, roles, consents, devices (push tokens) |
| parties | People and organisations: holders, invoice recipients, beneficiaries |
| patients | App profile of a beneficiary, dependants, `/me` |
| policies | Coverage catalogue, policies, coverages, limits, beneficiaries, premium adjustments, lifecycle |
| eligibility | Pure rules engine plus a call-usage ledger |
| doctors | Profiles, licence checks, care teams, personal-doctor assignments |
| availability | Status the doctor sets, shifts, Redis presence, "effectively available" |
| calls | State machine, configurable routing, LiveKit adapter, LiveKit webhooks, timeouts and sweeper jobs, callbacks |
| consultations | Notes per call (draft, then signed) |
| notifications | FCM, APNs VoIP and SMS adapters, templates in Albanian and English |
| realtime | Socket.IO gateway (JWT) |
| settings | Routing timeouts, business hours, holidays |
| audit | Append-only log with before/after changes |

Modules talk through in-process events. Vendors sit behind interfaces (`CallProvider`, `PushProvider`, `SmsProvider`).

## 5. Data model (summary)

- **Identity:** `User` (role PATIENT/DOCTOR/STAFF, staffRole), `Session`, `Device`, `Consent`
- **Parties:** `Party` (PERSON or ORGANIZATION; NID and NIPT), `Patient` (1:1 with a PERSON party; userId stays null until activation)
- **Policies:**
  - `Insurer`
  - `CoverageType` (the catalogue, including the **features** it unlocks: TELEMED_AUDIO, TELEMED_VIDEO, TELEMED_24_7, ONCALL_FALLBACK, CALLBACK)
  - `Policy` (serial, issued, start and end dates, holder, premium, status)
  - `PolicyInvoiceRecipient` and `PolicyBeneficiary`
  - `PolicyCoverage` (name, description, premium, sum insured)
  - `CoverageLimit` (kind MIN/MAX/FRANCHISE/DEDUCTIBLE/COUNT/…, basis, value, period)
  - `PremiumAdjustment` and `BenefitUsage`
- **Doctors:** `Doctor`, `CareTeam`, `DoctorAssignment` (one active per patient), `OnCallShift`
- **Calls:** `Call` (state, direction, eligibility snapshot; its LiveKit room is `call-<id>`), `CallAttempt`, `CallEvent` (append-only), `CallbackRequest`, `CallFeedback`, `Consultation`
- **Platform:** `Notification`, `AuditLog`, `SystemSetting`
- **Conventions:** UUID v7 IDs, UTC timestamps, money as `Decimal(18,2)` plus a currency code; NIDs and notes encrypted at field level.
- **Enforced by the database:** one active call per patient, one active call per doctor, a unique policy serial.

## 6. Auth and access

- **Patients:**
  - activate with NID + date of birth, then an SMS code sent to the phone stored on the policy, then set a password;
  - a new device needs an SMS code; after that, a biometric unlock.
- **Doctors and staff:** invitation only, TOTP required.
- **Tokens:** a JWT that lasts 10–15 minutes, plus an opaque refresh token tied to the device that is replaced on every use (reusing an old one revokes the family). Passwords use argon2id.
- **Access rules:** roles plus resource-level checks.
  - A patient sees only their own policy view: coverages, limits and sum insured, but **no premiums or billing**.
  - A doctor sees a patient only when there is a care relationship.

## 7. Eligibility (pure function)

1. There is an active beneficiary on an active policy, within its dates.
2. One of the policy's coverages unlocks the requested feature.
3. It's within business hours, unless the coverage unlocks `TELEMED_24_7`.
4. The coverage's COUNT limit isn't used up. Money limits are only displayed.

The engine returns reason codes, which the app translates. A call is counted when it connects.

## 8. Doctor availability

- **Status set by the doctor** (AVAILABLE/AWAY/OFFLINE) is stored in Postgres; **presence** is in Redis with a 25-second heartbeat.
- **Effectively available** = AVAILABLE + a valid push token + not in a call + not flagged unreachable. A socket connection is *not* required.
- **Safeguards:**
  - two rings the phone never acknowledged set the doctor to AWAY;
  - the end of a shift sets them OFFLINE;
  - rejected push tokens are invalidated.

## 9. Calling (LiveKit)

- **One LiveKit room per call** (`call-<id>`):
  - the patient gets a token for it when the call is created and waits there;
  - the **doctor gets a token only when they accept**;
  - a token is for that one room, carries only the user's id (no name) and lasts 10 minutes (LiveKit refreshes it for connected participants);
  - recording is off.
- **Why LiveKit, not ACS:** Microsoft retires ACS as a standalone service on 30 September 2028. Rooms, phone numbers and the UI Library are removed, and new customers can't sign up for them from 23 October 2026. ACS also never had a React Native SDK. LiveKit has an official React Native SDK, is open source (Apache 2.0) so it can run in Albania, and can dial phone numbers.
- **Routing is ours:**
  1. the personal doctor (30 s);
  2. up to N on-call doctors rung at the same time; **the first to accept wins** (`UPDATE … WHERE state='RINGING'`), and the rest get 409;
  3. otherwise `UNANSWERED`, then a callback request.
- **States:**
  ```
  INITIATED → RINGING → ACCEPTED → IN_PROGRESS → ENDED
  RINGING → CANCELED | UNANSWERED     any → FAILED
  ```
  A single `transition()` function (optimistic locking) writes each change to `CallEvent` and emits events.
- **Keeping in step with LiveKit:** the apps report `/joined` and `/end`, LiveKit webhooks send room events, and a sweeper runs every minute. Ending a call deletes its room, which disconnects both phones.
- **Push:**
  - iOS: a VoIP push goes to CallKit. Every VoIP push must be reported to CallKit, and a call is **never cancelled with a VoIP push** (the socket and a 409 do that).
  - Android: an FCM data message goes to Core-Telecom.
  - `expo-callkit-telecom` reads both pushes natively, so a closed app rings. It owns the audio session; the app must not start LiveKit's own `AudioSession`.
- **Phone numbers (PSTN):** LiveKit SIP dials a phone number into the call's room through a SIP trunk: a provider that reaches +355 numbers for the demo, an Albanian operator's trunk for production.

## 10. API (`/api/v1`)

| Group | Main endpoints |
|---|---|
| auth | activation start/verify/complete, login, refresh, logout, password reset, MFA, invite accept |
| me | profile, policies (the patient's view), eligibility, my doctor, devices, consents |
| calls | create, ack, accept, decline, cancel, token, joined, end, feedback, history |
| callbacks · consultations · doctor | callback queue; notes (draft, then sign); doctor status, shifts, patients |
| admin | coverage-types, parties, policies (+ activate/suspend/cancel, beneficiaries, coverages, adjustments, history), doctors, care-teams, assignments, shifts, calls, settings, audit-logs |
| system | `/webhooks/livekit`, health |

WebSocket `/realtime`: `call.incoming`, `call.state_changed`, `call.cancelled`, `doctor.availability_changed`. Errors follow RFC 7807 with stable codes.

## 11. Security (Albania)

- **Law:** Albanian personal-data-protection law, which follows the GDPR; the regulator is the IDP Commissioner. Ministry of Health and Order of Physicians rules apply to care, and AMF rules to policy records.
- **Data location:** everything stored stays in Albania. LiveKit Cloud (EU), APNs and FCM see only media passing through, or IDs. A self-hosted LiveKit server keeps the media in Albania too.
- **Encryption:** TLS everywhere, field-level encryption for NIDs and notes, encrypted backups copied to a second site.
- **No health data** in logs, pushes or error reports (self-hosted GlitchTip). No analytics SDKs.
- **Mobile:** SecureStore, biometric lock, screenshot blocking, no cached health data saved on the device.
- **Audit and compliance:** an audit log of every access to health data; a DPIA before launch; staging uses test data only.

## 12. Infrastructure

- **Production:** virtual machines in an Albanian datacenter, running Docker Compose.
  - a reverse proxy (TLS) that also serves the admin web;
  - 2 or more API containers;
  - Postgres with a replica and pgBackRest backups;
  - Redis;
  - Prometheus, Grafana, Loki and GlitchTip.
- **LiveKit:** one LiveKit Cloud project per environment (EU data region) for now. If media must stay in Albania, the LiveKit server (and its SIP service) runs on the Albanian VMs next to the API.
- **CI:** GitHub Actions (lint, typecheck, test, contract drift). Apps are built and published with EAS Build and Submit.

## 13. Phases

0. **Foundations and spike:** monorepo, CI; **LiveKit + expo-callkit-telecom + VoIP push ringing a closed app** on real phones.
1. **Policy administration:** staff auth, the policy schema, the admin policy wizard, the eligibility engine.
2. **Patient app and doctors:** activation, the coverage screen, doctors and assignments, availability, realtime, push.
3. **Calling:** state machine, routing, LiveKit adapter, callbacks, notes, in-call screen.
4. **Operations:** call monitor, audit viewer, settings, production in Albania, monitoring, restore drill.
5. **Launch:** penetration test, load tests, DPIA, app stores.

**Later:** chat, appointments, e-prescriptions, documents, deducting costs from coverages, invoicing, more insurers.

## 14. Open questions

- **L1:** Can call media go through LiveKit Cloud in the EU? If yes, stay on LiveKit Cloud (the Scale plan adds EU region pinning and a DPA). If no, self-host LiveKit in Albania; the app doesn't change. For now: LiveKit Cloud, and the app is only a demo on a local iPhone.
- **L2:** What the data-protection, telemedicine, medical-record and AMF rules actually require.
- **D2:** The 24/7 model: fallback pool size, shifts, answer-time target.
- **P1:** Which coverage types unlock telemedicine, and their COUNT limits.
- **P2:** Can coverages differ per beneficiary? *(This affects the schema.)*
- **P3:** What beneficiaries can see.
- **P4:** Is the policy serial typed in or generated?
- **P5:** Policy lifecycle and endorsements; does a second person approve changes?
- **P6:** Invoice recipients stored as data only, with no invoicing?
- **P7:** Which currencies, and no conversion?
- **P8:** Can policy holders use the app?
- **P9:** Can parents call on behalf of children?
- **P10:** Clinical scope: notes only, or a summary the patient sees?
- **P11:** Recording: assumed never.
- **P12:** What counts as a used call.
- **P13:** Suppliers: Albanian hosting, SMS gateway, app store accounts under the legal entity.
- **P14:** Expected scale.
