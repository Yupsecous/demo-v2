import { describe, it, expect } from 'vitest';
import { VOICE_LIBRARY, resolveVoice } from './voiceLibrary';
import { voicePickEntry } from '../test/fixtures';

// P0-1 regression: voicePicker stores user-account voice ids that aren't
// in the hardcoded VOICE_LIBRARY. The naive lookup returned undefined and
// AudioStep rendered "Upstream selection missing" — the bug Steve hit.
// resolveVoice walks the script step's voice-pick history to recover the
// display name and uses the id directly as the elevenlabs_voice_id.

describe('resolveVoice', () => {
  it('returns null for null/undefined id', () => {
    expect(resolveVoice(null, [])).toBeNull();
    expect(resolveVoice(undefined, [])).toBeNull();
  });

  it('finds hardcoded library voices by id', () => {
    const brian = VOICE_LIBRARY.find((v) => v.id === 'brian');
    const found = resolveVoice('brian', []);
    expect(found?.id).toBe('brian');
    expect(found?.elevenlabsVoiceId).toBe(brian?.elevenlabsVoiceId);
    expect(found?.displayName).toBe('Brian');
  });

  it('synthesizes a voice from voice-pick history for user-account ids', () => {
    const userVoiceId = '9BWtsMINqrJLrRacOk9x';
    const history = [voicePickEntry(userVoiceId, 'Aria')];
    const found = resolveVoice(userVoiceId, history);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(userVoiceId);
    expect(found?.displayName).toBe('Aria');
    expect(found?.elevenlabsVoiceId).toBe(userVoiceId);
  });

  it('prefers the most recent voice-pick entry if multiple match the id', () => {
    const id = 'voiceX';
    const history = [
      voicePickEntry(id, 'OldName'),
      voicePickEntry('other', 'Other'),
      voicePickEntry(id, 'NewName'),
    ];
    expect(resolveVoice(id, history)?.displayName).toBe('NewName');
  });

  it('falls back to the id as displayName when no history match exists', () => {
    const id = 'mystery-voice';
    const found = resolveVoice(id, []);
    expect(found?.displayName).toBe(id);
    expect(found?.elevenlabsVoiceId).toBe(id);
  });

  it('hardcoded library wins over history', () => {
    // Should never happen in practice, but defensive: the library entry
    // is preferred because it has a real toneLabel and a different
    // elevenlabs id (the synthetic record would use the wrong endpoint).
    const history = [voicePickEntry('brian', 'NOT BRIAN')];
    const found = resolveVoice('brian', history);
    expect(found?.displayName).toBe('Brian');
  });
});
