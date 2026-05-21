import type { StateCreator } from 'zustand';
import type {
  CachedStepState,
  Critique,
  RefineEntry,
  StepId,
  StepState,
  StepStatus,
  Variant,
  VariantCache,
} from '../types';
import { STEP_LABELS, STEP_ORDER, cacheKey } from '../types';
import { computeStepHash } from '../services/stepHash';
import type { SettingsSlice } from './settings.slice';
import type { BriefSlice } from './brief.slice';

// Local alias to avoid the circular type import from `store/index.ts`.
type FullState = StepsSlice & BriefSlice & SettingsSlice;

export type StepsSlice = {
  steps: Record<StepId, StepState>;
  variantCache: VariantCache;
  setStepStatus: (id: StepId, status: StepStatus) => void;
  selectVariant: (id: StepId, index: number) => void;
  appendVariants: (id: StepId, variants: Variant[]) => void;
  replaceVariants: (id: StepId, variants: Variant[]) => void;
  addHistoryEntry: (id: StepId, entry: RefineEntry) => void;
  setCritique: (id: StepId, variantId: string, critique: Critique) => void;
  approveStep: (id: StepId) => void;
  reopenStep: (id: StepId) => void;
  pickVariant: (id: StepId, index: number) => void;
  setVoiceId: (id: StepId, voiceId: string) => void;
  revertVoicePick: () => void;
  restoreFromCache: (id: StepId, hash: string) => boolean;
  resetSteps: () => void;
  beginFirstStep: () => void;
};

export function emptyStep(id: StepId): StepState {
  return {
    id,
    label: STEP_LABELS[id],
    status: 'pending',
    variants: [],
    selectedIndex: null,
    selectedVoiceId: null,
    history: [],
    critiques: {},
  };
}

function emptySteps(): Record<StepId, StepState> {
  return {
    copy: emptyStep('copy'),
    image: emptyStep('image'),
    script: emptyStep('script'),
    audio: emptyStep('audio'),
  };
}

function cascadeNext(
  steps: Record<StepId, StepState>,
  id: StepId,
): Record<StepId, StepState> {
  const order = STEP_ORDER.indexOf(id);
  const nextId = order >= 0 ? STEP_ORDER[order + 1] : undefined;
  if (!nextId) return steps;
  if (steps[nextId].status !== 'pending') return steps;
  return { ...steps, [nextId]: { ...steps[nextId], status: 'generating' } };
}

function clearDownstream(
  steps: Record<StepId, StepState>,
  id: StepId,
): Record<StepId, StepState> {
  const order = STEP_ORDER.indexOf(id);
  if (order < 0) return steps;
  const next = { ...steps };
  for (let i = order + 1; i < STEP_ORDER.length; i++) {
    const downId = STEP_ORDER[i]!;
    next[downId] = {
      ...next[downId],
      status: 'pending',
      variants: [],
      selectedIndex: null,
      selectedVoiceId: null,
      critiques: {},
      // history retained — audit trail survives; the cache lives separately
    };
  }
  return next;
}

function writeCache(
  cache: VariantCache,
  state: FullState,
  id: StepId,
): VariantCache {
  const hash = computeStepHash(state, id);
  const step = state.steps[id];
  const key = cacheKey(id, hash);
  const existing = cache[key];
  const entry: CachedStepState = {
    variants: step.variants,
    selectedIndex: step.selectedIndex,
    critiques: step.critiques,
    cachedAt: existing?.cachedAt ?? Date.now(),
    ...(id === 'script' ? { selectedVoiceId: step.selectedVoiceId } : {}),
  };
  return { ...cache, [key]: entry };
}

export const createStepsSlice: StateCreator<FullState, [], [], StepsSlice> = (set) => ({
  steps: emptySteps(),
  variantCache: {},

  setStepStatus: (id, status) =>
    set((s) => ({ steps: { ...s.steps, [id]: { ...s.steps[id], status } } })),

  selectVariant: (id, index) =>
    set((s) => ({ steps: { ...s.steps, [id]: { ...s.steps[id], selectedIndex: index } } })),

  appendVariants: (id, variants) =>
    set((s) => {
      const nextSteps = {
        ...s.steps,
        [id]: { ...s.steps[id], variants: [...s.steps[id].variants, ...variants] },
      };
      const nextCache = writeCache(s.variantCache, { ...s, steps: nextSteps }, id);
      return { steps: nextSteps, variantCache: nextCache };
    }),

  replaceVariants: (id, variants) =>
    set((s) => {
      const nextSteps = clearDownstream(
        {
          ...s.steps,
          [id]: { ...s.steps[id], variants, selectedIndex: null, critiques: {} },
        },
        id,
      );
      const nextCache = writeCache(s.variantCache, { ...s, steps: nextSteps }, id);
      return { steps: nextSteps, variantCache: nextCache };
    }),

  addHistoryEntry: (id, entry) =>
    set((s) => ({
      steps: { ...s.steps, [id]: { ...s.steps[id], history: [...s.steps[id].history, entry] } },
    })),

  setCritique: (id, variantId, critique) =>
    set((s) => {
      const nextSteps = {
        ...s.steps,
        [id]: {
          ...s.steps[id],
          critiques: { ...s.steps[id].critiques, [variantId]: critique },
        },
      };
      const nextCache = writeCache(s.variantCache, { ...s, steps: nextSteps }, id);
      return { steps: nextSteps, variantCache: nextCache };
    }),

  approveStep: (id) =>
    set((s) => ({ steps: { ...s.steps, [id]: { ...s.steps[id], status: 'approved' } } })),

  reopenStep: (id) =>
    set((s) => {
      const step = s.steps[id];
      const next: StepStatus = step.variants.length > 0 ? 'options' : 'pending';
      const patched: StepState =
        id === 'script'
          ? { ...step, status: next, selectedIndex: null, selectedVoiceId: null }
          : { ...step, status: next };
      return { steps: { ...s.steps, [id]: patched } };
    }),

  pickVariant: (id, index) =>
    set((s) => {
      const previousIndex = s.steps[id].selectedIndex;
      const selectionChanged = previousIndex !== null && previousIndex !== index;

      let nextSteps: Record<StepId, StepState>;
      if (id === 'script') {
        nextSteps = {
          ...s.steps,
          [id]: { ...s.steps[id], selectedIndex: index },
        };
      } else {
        nextSteps = {
          ...s.steps,
          [id]: { ...s.steps[id], selectedIndex: index, status: 'approved' },
        };
      }

      if (selectionChanged) {
        nextSteps = clearDownstream(nextSteps, id);
      }

      if (id !== 'script') {
        nextSteps = cascadeNext(nextSteps, id);
      }

      const nextCache = writeCache(s.variantCache, { ...s, steps: nextSteps }, id);
      return { steps: nextSteps, variantCache: nextCache };
    }),

  setVoiceId: (id, voiceId) =>
    set((s) => {
      const previousVoice = s.steps[id].selectedVoiceId;
      const voiceChanged = previousVoice !== null && previousVoice !== voiceId;

      let nextSteps: Record<StepId, StepState> = {
        ...s.steps,
        [id]: { ...s.steps[id], selectedVoiceId: voiceId, status: 'approved' },
      };

      if (voiceChanged) {
        nextSteps = clearDownstream(nextSteps, id);
      }
      nextSteps = cascadeNext(nextSteps, id);

      const nextCache = writeCache(s.variantCache, { ...s, steps: nextSteps }, id);
      return { steps: nextSteps, variantCache: nextCache };
    }),

  // Targeted undo for "back from audio step": clears the voice pick on
  // script and resets audio's working state. Script's selectedIndex is
  // preserved (the user keeps their script choice), so the user lands
  // back in script step Phase B (the voice picker). Audio's variants
  // are cleared from the live state but the cache still holds them, so
  // picking the same voice again restores the audio instantly.
  revertVoicePick: () =>
    set((s) => {
      const scriptStep = s.steps.script;
      const audioStep = s.steps.audio;
      return {
        steps: {
          ...s.steps,
          script: {
            ...scriptStep,
            selectedVoiceId: null,
            status: scriptStep.variants.length > 0 ? 'options' : 'pending',
          },
          audio: {
            ...audioStep,
            variants: [],
            selectedIndex: null,
            status: 'pending',
          },
        },
      };
    }),

  restoreFromCache: (id, hash) => {
    let restored = false;
    set((s) => {
      const entry = s.variantCache[cacheKey(id, hash)];
      if (!entry) return s;
      restored = true;

      const isApproved = entry.selectedIndex !== null;
      let nextSteps: Record<StepId, StepState> = {
        ...s.steps,
        [id]: {
          ...s.steps[id],
          variants: entry.variants,
          selectedIndex: entry.selectedIndex,
          critiques: entry.critiques,
          ...(id === 'script' && entry.selectedVoiceId !== undefined
            ? { selectedVoiceId: entry.selectedVoiceId }
            : {}),
          status: isApproved ? ('approved' as const) : ('options' as const),
          history: [
            ...s.steps[id].history,
            { id: crypto.randomUUID(), kind: 'cache-restore' as const, timestamp: Date.now() },
          ],
        },
      };

      // For script, approved means voice is also selected; cascade only fires then.
      const scriptApproved =
        id === 'script' && entry.selectedIndex !== null && entry.selectedVoiceId;
      if ((id !== 'script' && isApproved) || scriptApproved) {
        nextSteps = cascadeNext(nextSteps, id);
      }

      return { steps: nextSteps };
    });
    return restored;
  },

  resetSteps: () => set({ steps: emptySteps(), variantCache: {} }),

  beginFirstStep: () =>
    set((s) => {
      const first = STEP_ORDER[0];
      if (!first) return s;
      return {
        steps: { ...s.steps, [first]: { ...s.steps[first], status: 'generating' } },
      };
    }),
});
