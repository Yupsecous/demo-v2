// Centralized plain-language error messages.
//
// Services throw Error instances whose .message is one of the codes below.
// UI components call humanize() to render. Technical detail still goes to
// the console so the user-facing string stays calm.
//
// To add a new error: pick a code, add an entry to MESSAGES, throw an
// AppError(code) from the service.

export type ErrorCode =
  | 'openai/auth-failed'
  | 'openai/rate-limit'
  | 'openai/network'
  | 'openai/bad-response'
  | 'openai/missing-key'
  | 'fal/auth-failed'
  | 'fal/no-credits'
  | 'fal/forbidden'
  | 'fal/rate-limit'
  | 'fal/network'
  | 'fal/bad-response'
  | 'fal/missing-key'
  | 'eleven/auth-failed'
  | 'eleven/voice-not-found'
  | 'eleven/rate-limit'
  | 'eleven/network'
  | 'eleven/bad-response'
  | 'eleven/missing-key'
  | 'anthropic/auth-failed'
  | 'anthropic/rate-limit'
  | 'anthropic/network'
  | 'anthropic/bad-response'
  | 'anthropic/missing-key'
  | 'translator/wrong-shape'
  | 'translator/empty-direction'
  | 'image/all-failed'
  | 'unknown';

type ErrorEntry = {
  message: string;
  // If true, the UI's "Open Settings" button is the primary affordance.
  pointToSettings?: boolean;
};

const MESSAGES: Record<ErrorCode, ErrorEntry> = {
  'openai/auth-failed': {
    message:
      "Your OpenAI key isn't being accepted. Open Settings and paste it again — sometimes a stray space gets copied with it.",
    pointToSettings: true,
  },
  'openai/rate-limit': {
    message: 'OpenAI is busy. Try again in a few seconds.',
  },
  'openai/network': {
    message: "Couldn't reach OpenAI. Check your internet and try again.",
  },
  'openai/bad-response': {
    message: 'OpenAI returned an unexpected response. Try again — this usually clears on retry.',
  },
  'openai/missing-key': {
    message: 'Add your OpenAI key in Settings to continue.',
    pointToSettings: true,
  },
  'fal/auth-failed': {
    message: "Your fal.ai key isn't being accepted. Open Settings and check it.",
    pointToSettings: true,
  },
  'fal/no-credits': {
    message:
      "Your fal.ai account is out of credits. Top up at fal.ai/dashboard and try again.",
  },
  'fal/forbidden': {
    message:
      "Your fal.ai key doesn't have access to Flux Schnell. Check the key's permissions in your fal.ai dashboard.",
  },
  'fal/rate-limit': {
    message: 'fal.ai is busy. Wait a moment and try again.',
  },
  'fal/network': {
    message: "Couldn't reach fal.ai. Check your internet and try again.",
  },
  'fal/bad-response': {
    message: 'fal.ai returned an unexpected response. Try again — this usually clears on retry.',
  },
  'fal/missing-key': {
    message: 'Add your fal.ai key in Settings to generate images.',
    pointToSettings: true,
  },
  'eleven/auth-failed': {
    message: "Your ElevenLabs key isn't being accepted. Open Settings and check it.",
    pointToSettings: true,
  },
  'eleven/voice-not-found': {
    message: "This voice isn't available on your ElevenLabs account. Pick a different voice.",
  },
  'eleven/rate-limit': {
    message: 'ElevenLabs is busy. Wait a moment and try again.',
  },
  'eleven/network': {
    message: "Couldn't reach ElevenLabs. Check your internet and try again.",
  },
  'eleven/bad-response': {
    message: 'ElevenLabs returned an unexpected response. Try again — this usually clears on retry.',
  },
  'eleven/missing-key': {
    message: 'Add your ElevenLabs key in Settings to render audio.',
    pointToSettings: true,
  },
  'anthropic/auth-failed': {
    message: "Your Anthropic key isn't being accepted. Open Settings and check it.",
    pointToSettings: true,
  },
  'anthropic/rate-limit': {
    message: 'Anthropic is busy. Wait a moment and try again.',
  },
  'anthropic/network': {
    message: "Couldn't reach Anthropic. Check your internet and try again.",
  },
  'anthropic/bad-response': {
    message: 'Anthropic returned an unexpected response. Try again — this usually clears on retry.',
  },
  'anthropic/missing-key': {
    message: 'Add your Anthropic key in Settings to enable image critique.',
    pointToSettings: true,
  },
  'translator/wrong-shape': {
    message: "Couldn't translate the direction. Try a slightly different phrasing.",
  },
  'translator/empty-direction': {
    message: 'Type a direction first, then click Refine.',
  },
  'image/all-failed': {
    message: 'All image attempts failed. Try once more — fal.ai is sometimes flaky on bursts.',
  },
  unknown: {
    message: 'Something went wrong. Try again — and if it keeps happening, open Settings and re-check your keys.',
  },
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly detail?: string,
  ) {
    super(code);
    this.name = 'AppError';
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof Error && e.name === 'AppError' && 'code' in e;
}

export function humanize(err: unknown): { message: string; pointToSettings: boolean; code: ErrorCode } {
  if (isAppError(err)) {
    if (err.detail) {
      // Technical detail to console only; keeps the UI calm.
      // eslint-disable-next-line no-console
      console.debug('[AppError]', err.code, err.detail);
    }
    const entry = MESSAGES[err.code];
    return {
      message: entry.message,
      pointToSettings: entry.pointToSettings ?? false,
      code: err.code,
    };
  }
  if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.debug('[UnknownError]', err.message);
    return { message: MESSAGES.unknown.message, pointToSettings: false, code: 'unknown' };
  }
  return { message: MESSAGES.unknown.message, pointToSettings: false, code: 'unknown' };
}
