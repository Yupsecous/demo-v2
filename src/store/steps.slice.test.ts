import { describe, it, expect, beforeEach } from 'vitest';
import { create, type StoreApi } from 'zustand';
import { createStepsSlice } from './steps.slice';
import { createBriefSlice } from './brief.slice';
import { createSettingsSlice } from './settings.slice';
import { isStepUnlocked, activeStepId, allApproved, type AppState } from './index';
import {
  copyVariant,
  imageVariant,
  scriptVariant,
  audioVariant,
} from '../test/fixtures';

// Fresh store per test — no persist middleware, no sessionStorage
// interference. Tests the slice's invariants in isolation.
function makeTestStore(): StoreApi<AppState> {
  return create<AppState>()((...a) => ({
    ...createSettingsSlice(...a),
    ...createBriefSlice(...a),
    ...createStepsSlice(...a),
  }));
}

let store: StoreApi<AppState>;
beforeEach(() => {
  store = makeTestStore();
});

describe('isStepUnlocked (gating invariants)', () => {
  it('all steps locked when brief not submitted', () => {
    const s = store.getState();
    expect(isStepUnlocked(s, 'copy')).toBe(false);
    expect(isStepUnlocked(s, 'image')).toBe(false);
    expect(isStepUnlocked(s, 'script')).toBe(false);
    expect(isStepUnlocked(s, 'audio')).toBe(false);
  });

  it('only copy unlocked after brief submitted', () => {
    store.getState().setBriefField('productName', 'P');
    store.getState().setBriefField('targetAudience', 'A');
    store.getState().setBriefField('adAngle', 'X');
    store.getState().submitBrief();
    const s = store.getState();
    expect(isStepUnlocked(s, 'copy')).toBe(true);
    expect(isStepUnlocked(s, 'image')).toBe(false);
    expect(isStepUnlocked(s, 'script')).toBe(false);
    expect(isStepUnlocked(s, 'audio')).toBe(false);
  });

  it('copy + image unlocked after copy approved', () => {
    store.getState().setBriefField('productName', 'P');
    store.getState().setBriefField('targetAudience', 'A');
    store.getState().setBriefField('adAngle', 'X');
    store.getState().submitBrief();
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    const s = store.getState();
    expect(isStepUnlocked(s, 'copy')).toBe(true);
    expect(isStepUnlocked(s, 'image')).toBe(true);
    expect(isStepUnlocked(s, 'script')).toBe(false);
    expect(isStepUnlocked(s, 'audio')).toBe(false);
  });

  it('jumping to script before image approved is impossible', () => {
    store.getState().submitBrief(); // empty brief, but submit anyway for test
    store.getState().setBriefField('productName', 'P');
    store.getState().setBriefField('targetAudience', 'A');
    store.getState().setBriefField('adAngle', 'X');
    store.getState().submitBrief();
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    // copy approved, image is generating with no variants yet
    expect(isStepUnlocked(store.getState(), 'script')).toBe(false);
    // Even adding image variants doesn't unlock script — image must be approved
    store.getState().appendVariants('image', [imageVariant()]);
    expect(isStepUnlocked(store.getState(), 'script')).toBe(false);
  });
});

describe('activeStepId', () => {
  it('returns null before brief submitted', () => {
    expect(activeStepId(store.getState())).toBeNull();
  });

  it('returns the first non-approved step in order', () => {
    store.getState().setBriefField('productName', 'P');
    store.getState().setBriefField('targetAudience', 'A');
    store.getState().setBriefField('adAngle', 'X');
    store.getState().submitBrief();
    expect(activeStepId(store.getState())).toBe('copy');
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    expect(activeStepId(store.getState())).toBe('image');
  });
});

describe('cascade — pending → generating on upstream approval', () => {
  beforeEach(() => {
    store.getState().setBriefField('productName', 'P');
    store.getState().setBriefField('targetAudience', 'A');
    store.getState().setBriefField('adAngle', 'X');
    store.getState().submitBrief();
    store.getState().beginFirstStep();
  });

  it('image step auto-cascades from pending → generating on copy approval', () => {
    expect(store.getState().steps.image.status).toBe('pending');
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    expect(store.getState().steps.image.status).toBe('generating');
  });

  it('script does NOT cascade until image is approved (sequential gate)', () => {
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    // image is now generating
    store.getState().appendVariants('image', [imageVariant()]);
    // image variants exist but no pick yet
    expect(store.getState().steps.script.status).toBe('pending');
    store.getState().pickVariant('image', 0);
    expect(store.getState().steps.script.status).toBe('generating');
  });

  it('script + voice cascade triggers audio generation', () => {
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    store.getState().appendVariants('image', [imageVariant()]);
    store.getState().pickVariant('image', 0);
    store.getState().appendVariants('script', [scriptVariant()]);
    store.getState().pickVariant('script', 0);
    // script pick alone does NOT cascade audio
    expect(store.getState().steps.audio.status).toBe('pending');
    store.getState().setVoiceId('script', 'brian');
    expect(store.getState().steps.audio.status).toBe('generating');
  });

  it('allApproved becomes true after audio approval', () => {
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    store.getState().appendVariants('image', [imageVariant()]);
    store.getState().pickVariant('image', 0);
    store.getState().appendVariants('script', [scriptVariant()]);
    store.getState().pickVariant('script', 0);
    store.getState().setVoiceId('script', 'brian');
    store.getState().appendVariants('audio', [audioVariant()]);
    store.getState().pickVariant('audio', 0);
    expect(allApproved(store.getState())).toBe(true);
  });
});

describe('downstream invalidation (clearDownstream)', () => {
  function setup() {
    store.getState().setBriefField('productName', 'P');
    store.getState().setBriefField('targetAudience', 'A');
    store.getState().setBriefField('adAngle', 'X');
    store.getState().submitBrief();
    store.getState().appendVariants('copy', [copyVariant('A'), copyVariant('B')]);
    store.getState().pickVariant('copy', 0);
    store.getState().appendVariants('image', [imageVariant()]);
    store.getState().pickVariant('image', 0);
    store.getState().appendVariants('script', [scriptVariant()]);
    store.getState().pickVariant('script', 0);
    store.getState().setVoiceId('script', 'brian');
    store.getState().appendVariants('audio', [audioVariant()]);
  }

  it('changing copy selection clears downstream variants AND demotes their status', () => {
    setup();
    const before = store.getState();
    expect(before.steps.image.variants.length).toBeGreaterThan(0);
    expect(before.steps.script.variants.length).toBeGreaterThan(0);
    // Re-pick a DIFFERENT copy variant
    store.getState().pickVariant('copy', 1);
    const after = store.getState();
    expect(after.steps.image.variants.length).toBe(0);
    expect(after.steps.script.variants.length).toBe(0);
    expect(after.steps.audio.variants.length).toBe(0);
    expect(after.steps.image.selectedIndex).toBeNull();
    expect(after.steps.script.selectedIndex).toBeNull();
  });

  it('first-time copy pick does NOT trigger clearDownstream', () => {
    // Fresh: copy never picked
    store.getState().setBriefField('productName', 'P');
    store.getState().submitBrief();
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().appendVariants('image', [imageVariant()]); // pretend image existed somehow
    store.getState().pickVariant('copy', 0);
    // selection went from null → 0 (first-time), so downstream stays
    expect(store.getState().steps.image.variants.length).toBe(1);
  });

  it('re-picking the SAME copy variant does NOT trigger clearDownstream', () => {
    setup();
    store.getState().pickVariant('copy', 0); // same as before
    expect(store.getState().steps.image.variants.length).toBeGreaterThan(0);
    expect(store.getState().steps.script.variants.length).toBeGreaterThan(0);
  });

  it('changing voice clears audio only, NOT script (dependency chain)', () => {
    setup();
    const scriptVariantsBefore = store.getState().steps.script.variants.length;
    store.getState().setVoiceId('script', 'rachel');
    const after = store.getState();
    expect(after.steps.script.variants.length).toBe(scriptVariantsBefore);
    expect(after.steps.audio.variants.length).toBe(0);
  });

  it('first-time voice pick does NOT clear audio (voice was null)', () => {
    store.getState().setBriefField('productName', 'P');
    store.getState().submitBrief();
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    store.getState().appendVariants('image', [imageVariant()]);
    store.getState().pickVariant('image', 0);
    store.getState().appendVariants('script', [scriptVariant()]);
    store.getState().pickVariant('script', 0);
    store.getState().appendVariants('audio', [audioVariant()]);
    // voice was never set — first call should not clear audio
    store.getState().setVoiceId('script', 'brian');
    expect(store.getState().steps.audio.variants.length).toBe(1);
  });
});

describe('appendVariants vs replaceVariants', () => {
  function setup() {
    store.getState().setBriefField('productName', 'P');
    store.getState().submitBrief();
    store.getState().appendVariants('copy', [copyVariant()]);
    store.getState().pickVariant('copy', 0);
    store.getState().appendVariants('image', [imageVariant()]);
    store.getState().pickVariant('image', 0);
    store.getState().appendVariants('script', [scriptVariant()]);
  }

  it('appendVariants does NOT trigger clearDownstream', () => {
    setup();
    // Add two more copy variants via append (simulates "show 2 more")
    store.getState().appendVariants('copy', [copyVariant(), copyVariant()]);
    // Image's variants should still be intact
    expect(store.getState().steps.image.variants.length).toBe(1);
    expect(store.getState().steps.image.selectedIndex).toBe(0);
    expect(store.getState().steps.script.variants.length).toBe(1);
  });

  it('replaceVariants DOES trigger clearDownstream', () => {
    setup();
    // Simulate a copy refine
    store.getState().replaceVariants('copy', [copyVariant()]);
    expect(store.getState().steps.image.variants.length).toBe(0);
    expect(store.getState().steps.script.variants.length).toBe(0);
  });

  it('revertVoicePick clears voice and audio working state, keeps script pick', () => {
    // Build a fully-approved state through audio for this test.
    // Set all three brief fields so submitBrief() actually flips
    // briefSubmitted and activeStepId derives correctly.
    store.getState().setBriefField('targetAudience', 'A');
    store.getState().setBriefField('adAngle', 'X');
    setup();
    store.getState().pickVariant('script', 0);
    store.getState().setVoiceId('script', 'brian');
    store.getState().appendVariants('audio', [audioVariant()]);

    expect(store.getState().steps.script.selectedVoiceId).toBe('brian');
    expect(store.getState().steps.script.selectedIndex).toBe(0);
    expect(store.getState().steps.audio.variants.length).toBe(1);

    store.getState().revertVoicePick();

    const after = store.getState();
    expect(after.steps.script.selectedVoiceId).toBeNull();
    expect(after.steps.script.selectedIndex).toBe(0); // script pick preserved
    expect(after.steps.script.status).toBe('options');
    expect(after.steps.audio.variants.length).toBe(0);
    expect(after.steps.audio.selectedIndex).toBeNull();
    expect(after.steps.audio.status).toBe('pending');
    // activeStepId should now be 'script' (Phase B — selectedIndex set, no voice)
    expect(activeStepId(after)).toBe('script');
  });

  it('replaceVariants clears the step\'s own critiques', () => {
    setup();
    store.getState().setCritique('image', 'img-1', {
      variantId: 'img-1',
      text: 'A critique',
      createdAt: 1,
    });
    expect(Object.keys(store.getState().steps.image.critiques)).toHaveLength(1);
    store.getState().replaceVariants('image', [imageVariant()]);
    expect(Object.keys(store.getState().steps.image.critiques)).toHaveLength(0);
  });
});

describe('reopenStep', () => {
  it('script reopen clears selectedIndex AND selectedVoiceId, preserves variants', () => {
    store.getState().setBriefField('productName', 'P');
    store.getState().submitBrief();
    store.getState().appendVariants('script', [scriptVariant(), scriptVariant()]);
    store.getState().pickVariant('script', 1);
    store.getState().setVoiceId('script', 'brian');
    expect(store.getState().steps.script.status).toBe('approved');
    expect(store.getState().steps.script.selectedIndex).toBe(1);
    expect(store.getState().steps.script.selectedVoiceId).toBe('brian');

    store.getState().reopenStep('script');
    const s = store.getState().steps.script;
    expect(s.status).toBe('options');
    expect(s.selectedIndex).toBeNull();
    expect(s.selectedVoiceId).toBeNull();
    expect(s.variants.length).toBe(2);
  });

  it('non-script reopen preserves selectedIndex', () => {
    store.getState().setBriefField('productName', 'P');
    store.getState().submitBrief();
    store.getState().appendVariants('copy', [copyVariant(), copyVariant()]);
    store.getState().pickVariant('copy', 1);
    store.getState().reopenStep('copy');
    const s = store.getState().steps.copy;
    expect(s.status).toBe('options');
    expect(s.selectedIndex).toBe(1);
    expect(s.variants.length).toBe(2);
  });
});
