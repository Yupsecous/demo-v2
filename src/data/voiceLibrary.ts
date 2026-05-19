export type VoiceSample = {
  id: string;
  displayName: string;
  toneLabel: string;
  elevenlabsVoiceId: string;
  // Optional — only the hardcoded library has prerecorded MP3s. Voices
  // fetched from the user's ElevenLabs account at runtime don't carry a
  // preview file; the player skips preview for those and the user picks
  // by name + category.
  sampleMp3?: string;
};

export const VOICE_SAMPLE_SENTENCE =
  'When your campaigns land like this, you stop testing and start scaling.';

export const VOICE_LIBRARY: VoiceSample[] = [
  {
    id: 'brian',
    displayName: 'Brian',
    toneLabel: 'Confident, direct',
    elevenlabsVoiceId: 'nPczCjzI2devNBz1zQrb',
    sampleMp3: 'voices/brian.mp3',
  },
  {
    id: 'rachel',
    displayName: 'Rachel',
    toneLabel: 'Calm, grounded',
    elevenlabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
    sampleMp3: 'voices/rachel.mp3',
  },
  {
    id: 'adam',
    displayName: 'Adam',
    toneLabel: 'Energetic, urgent',
    elevenlabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
    sampleMp3: 'voices/adam.mp3',
  },
  {
    id: 'bella',
    displayName: 'Bella',
    toneLabel: 'Warm, friendly',
    elevenlabsVoiceId: 'EXAVITQu4DFVXJaQ7T2W',
    sampleMp3: 'voices/bella.mp3',
  },
  {
    id: 'antoni',
    displayName: 'Antoni',
    toneLabel: 'Authoritative, anchored',
    elevenlabsVoiceId: 'ErXwobaYiN019PkySvjV',
    sampleMp3: 'voices/antoni.mp3',
  },
  {
    id: 'domi',
    displayName: 'Domi',
    toneLabel: 'Bright, playful',
    elevenlabsVoiceId: 'AZnzlk1XvdvUeBnXmlld',
    sampleMp3: 'voices/domi.mp3',
  },
  {
    id: 'josh',
    displayName: 'Josh',
    toneLabel: 'Smooth narrator',
    elevenlabsVoiceId: 'TxGEqnHWrfWFTfGW9XjX',
    sampleMp3: 'voices/josh.mp3',
  },
  {
    id: 'elli',
    displayName: 'Elli',
    toneLabel: 'Punchy, energetic young',
    elevenlabsVoiceId: 'MF3mGyEYCl7XYWbV9V6O',
    sampleMp3: 'voices/elli.mp3',
  },
];

export function getVoiceById(id: string | null | undefined): VoiceSample | undefined {
  if (!id) return undefined;
  return VOICE_LIBRARY.find((v) => v.id === id);
}
