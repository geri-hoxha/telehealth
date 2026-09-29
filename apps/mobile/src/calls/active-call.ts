/** The call the call screen is handling, so the doctor's phone doesn't ring for it (or anything else) meanwhile. */
let activeCallId: string | null = null;

export const activeCall = {
  get: () => activeCallId,
  set: (callId: string | null) => {
    activeCallId = callId;
  },
};
