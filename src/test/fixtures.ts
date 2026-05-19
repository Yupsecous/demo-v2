import type {
  AudioVariant,
  CopyVariant,
  Critique,
  ImageVariant,
  RefineEntry,
  ScriptVariant,
  StepId,
  StepState,
  StepStatus,
  Variant,
} from '../types';
import { STEP_LABELS } from '../types';
import type { AppState } from '../store';

let idCounter = 0;
export function nextId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString().padStart(4, '0')}`;
}

export function copyVariant(headline = 'Hl', caption = 'Cap', cta = 'Cta'): CopyVariant {
  return {
    kind: 'copy',
    id: nextId('copy'),
    headline,
    caption,
    cta,
    createdAt: 1,
  };
}

export function imageVariant(prompt = 'a test image'): ImageVariant {
  return {
    kind: 'image',
    id: nextId('img'),
    imageUrl: `https://example.test/${nextId('url')}.jpg`,
    prompt,
    createdAt: 1,
  };
}

export function scriptVariant(script = 'Spoken read.'): ScriptVariant {
  return {
    kind: 'script',
    id: nextId('scr'),
    script,
    durationEstimate: 20,
    toneDescription: 'neutral',
    createdAt: 1,
  };
}

export function audioVariant(): AudioVariant {
  return {
    kind: 'audio',
    id: nextId('aud'),
    audioUrl: 'blob:mock',
    voiceId: 'brian',
    scriptId: 'scr-0001',
    createdAt: 1,
  };
}

export function refineEntry(direction: string): RefineEntry {
  return {
    id: nextId('hist'),
    kind: 'refine',
    direction,
    variantCount: 2,
    timestamp: 1,
  };
}

export function critiqueAppliedEntry(direction: string): RefineEntry {
  return {
    id: nextId('hist'),
    kind: 'critique-applied',
    direction,
    variantCount: 2,
    timestamp: 1,
  };
}

export function initialEntry(): RefineEntry {
  return { id: nextId('hist'), kind: 'initial', direction: null, variantCount: 2, timestamp: 1 };
}

export function moreEntry(): RefineEntry {
  return { id: nextId('hist'), kind: 'more', direction: null, variantCount: 2, timestamp: 1 };
}

export function voicePickEntry(voiceId: string, voiceName: string): RefineEntry {
  return { id: nextId('hist'), kind: 'voice-pick', voiceId, voiceName, timestamp: 1 };
}

export function cacheRestoreEntry(): RefineEntry {
  return { id: nextId('hist'), kind: 'cache-restore', timestamp: 1 };
}

export function regenerateEntry(): RefineEntry {
  return {
    id: nextId('hist'),
    kind: 'regenerate',
    discardedDurationSeconds: 18,
    timestamp: 1,
  };
}

export type StepOverrides = {
  status?: StepStatus;
  variants?: Variant[];
  selectedIndex?: number | null;
  selectedVoiceId?: string | null;
  history?: RefineEntry[];
  critiques?: Record<string, Critique>;
};

export function makeStep(id: StepId, overrides: StepOverrides = {}): StepState {
  return {
    id,
    label: STEP_LABELS[id],
    status: overrides.status ?? 'pending',
    variants: overrides.variants ?? [],
    selectedIndex: overrides.selectedIndex ?? null,
    selectedVoiceId: overrides.selectedVoiceId ?? null,
    history: overrides.history ?? [],
    critiques: overrides.critiques ?? {},
  };
}

export type StateOverrides = {
  brief?: Partial<AppState['brief']>;
  briefSubmitted?: boolean;
  copy?: StepOverrides;
  image?: StepOverrides;
  script?: StepOverrides;
  audio?: StepOverrides;
};

export function makeState(o: StateOverrides = {}): AppState {
  const state: Partial<AppState> = {
    brief: {
      productName: 'Test product',
      targetAudience: 'Test audience',
      adAngle: 'Test angle',
      ...(o.brief ?? {}),
    },
    briefSubmitted: o.briefSubmitted ?? true,
    keys: { fal: '', eleven: '', openai: '', anthropic: '' },
    validations: {
      fal: 'unchecked',
      eleven: 'unchecked',
      openai: 'unchecked',
      anthropic: 'unchecked',
    },
    drawerOpen: false,
    validating: false,
    steps: {
      copy: makeStep('copy', o.copy),
      image: makeStep('image', o.image),
      script: makeStep('script', o.script),
      audio: makeStep('audio', o.audio),
    },
    variantCache: {},
  };
  return state as AppState;
}
