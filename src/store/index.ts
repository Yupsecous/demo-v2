import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createSettingsSlice, type SettingsSlice } from './settings.slice';
import { createBriefSlice, type BriefSlice } from './brief.slice';
import { createStepsSlice, type StepsSlice } from './steps.slice';
import { STEP_ORDER, type StepId, type StepState, type VariantCache } from '../types';

export type AppState = SettingsSlice & BriefSlice & StepsSlice;

// Audio variants carry a Blob and an object URL — neither survives JSON
// serialization, so on rehydrate we strip the audio variants and demote
// the audio status so the auto-fire effect regenerates fresh audio.
function partializeAudio(audio: StepState): StepState {
  const demotedStatus =
    audio.status === 'approved' || audio.status === 'options' || audio.status === 'refining'
      ? 'generating'
      : audio.status;
  return {
    ...audio,
    variants: [],
    selectedIndex: null,
    selectedVoiceId: null,
    status: demotedStatus,
  };
}

function partializeCache(cache: VariantCache): VariantCache {
  const out: VariantCache = {};
  for (const [k, v] of Object.entries(cache)) {
    if (k.startsWith('audio:')) continue; // Blobs don't round-trip
    out[k] = v;
  }
  return out;
}

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createSettingsSlice(...a),
      ...createBriefSlice(...a),
      ...createStepsSlice(...a),
    }),
    {
      name: 'demo-v2-state',
      version: 6,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        keys: state.keys,
        brief: state.brief,
        briefSubmitted: state.briefSubmitted,
        steps: {
          copy: state.steps.copy,
          image: state.steps.image,
          script: state.steps.script,
          audio: partializeAudio(state.steps.audio),
        },
        variantCache: partializeCache(state.variantCache),
      }),
    },
  ),
);

export function isStepUnlocked(state: AppState, id: StepId): boolean {
  if (!state.briefSubmitted) return false;
  const idx = STEP_ORDER.indexOf(id);
  if (idx === -1) return false;
  if (idx === 0) return true;
  const prev = STEP_ORDER[idx - 1];
  if (!prev) return false;
  return state.steps[prev].status === 'approved';
}

export function activeStepId(state: AppState): StepId | null {
  if (!state.briefSubmitted) return null;
  for (const id of STEP_ORDER) {
    if (state.steps[id].status !== 'approved') return id;
  }
  return null;
}

export function allApproved(state: AppState): boolean {
  if (!state.briefSubmitted) return false;
  return STEP_ORDER.every((id) => state.steps[id].status === 'approved');
}
