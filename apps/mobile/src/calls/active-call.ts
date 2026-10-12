/** The call the call screen is handling, so the doctor's phone doesn't ring for it (or anything else) meanwhile. */
let activeCallId: string | null = null;

export const activeCall = {
  get: () => activeCallId,
  set: (callId: string | null) => {
    activeCallId = callId;
  },
};

/** The ringing session the in-app invitation shows, so it isn't opened twice and answering replaces it. */
let invitationSessionId: string | null = null;

export const invitationScreen = {
  get: () => invitationSessionId,
  set: (sessionId: string | null) => {
    invitationSessionId = sessionId;
  },
};
