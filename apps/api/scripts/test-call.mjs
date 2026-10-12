// Calls a doctor as the demo patient (patient@telehealth.al / 1234) and opens the patient's side in
// the browser through LiveKit Meet, so one phone logged in as the doctor is enough to test calls.
// The doctor's app must be open (or have a push device), or no doctor counts as reachable.
//
//   node apps/api/scripts/test-call.mjs          video call
//   node apps/api/scripts/test-call.mjs audio    voice call
//   node apps/api/scripts/test-call.mjs end      hangs up the last call started here
//
// API_URL overrides the API address (default http://localhost:3000/api).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const LAST_CALL_FILE = join(tmpdir(), 'telehealth-last-call');

const HINTS = {
  CALL_ALREADY_ACTIVE: 'The last call is still open. Hang it up with: node apps/api/scripts/test-call.mjs end',
  NO_DOCTOR_AVAILABLE:
    'No doctor can ring: open the app as doktor@telehealth.al (or register a push device for it), then try again.',
};

async function request(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`${method} ${path} failed (${res.status}): ${data.message ?? res.statusText}`);
    if (HINTS[data.code]) console.error(HINTS[data.code]);
    process.exit(1);
  }
  return data;
}

const mode = process.argv[2] ?? 'video';
const { accessToken } = await request('POST', '/auth/login', null, { email: 'patient@telehealth.al', password: '1234' });

if (mode === 'end') {
  if (!existsSync(LAST_CALL_FILE)) {
    console.error('No call was started from this script.');
    process.exit(1);
  }
  const call = await request('POST', `/calls/${readFileSync(LAST_CALL_FILE, 'utf8').trim()}/end`, accessToken);
  console.log(`The call is now ${call.state}.`);
} else {
  const media = mode === 'audio' ? 'AUDIO' : 'VIDEO';
  const { call, join: room } = await request('POST', '/calls', accessToken, { media });
  writeFileSync(LAST_CALL_FILE, call.id);
  const link =
    'https://meet.livekit.io/custom' +
    `?liveKitUrl=${encodeURIComponent(room.serverUrl)}&token=${encodeURIComponent(room.token)}`;
  console.log(
    call.doctor
      ? `Calling ${call.doctor.name} (${media.toLowerCase()}). Their phone rings for 40 seconds, then the next free doctor's.`
      : `Waiting in the queue (${call.queuePosition ?? 0} ahead); the next free doctor will ring.`,
  );
  console.log(`Patient side (opening in the browser): ${link}`);
  if (process.platform === 'darwin') execFileSync('open', [link]);
}
