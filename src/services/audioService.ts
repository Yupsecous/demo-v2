export type GenerateAudioArgs = {
  script: string;
  voiceId: string;
  apiKey: string;
};

export type GenerateAudioResult = {
  blob: Blob;
  url: string;
};

const MODEL = 'eleven_turbo_v2_5';

export async function generateAudio(args: GenerateAudioArgs): Promise<GenerateAudioResult> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new Error('ElevenLabs API key is required. Open Settings to add one.');
  }
  if (!args.voiceId) {
    throw new Error('Voice ID is missing. Pick a voice in the script step first.');
  }
  if (!args.script.trim()) {
    throw new Error('Script is empty. Pick a script in the script step first.');
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(args.voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: args.script,
          model_id: MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
  } catch (err) {
    throw new Error(
      `Network error reaching ElevenLabs: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('ElevenLabs rejected the API key (401). Re-check it in Settings.');
    }
    if (res.status === 422) {
      throw new Error(
        'ElevenLabs would not accept this voice (422). The voice may not be in your account.',
      );
    }
    if (res.status === 429) {
      throw new Error('ElevenLabs rate limit hit (429). Wait 10 seconds and try again.');
    }
    const text = await res.text().catch(() => '');
    throw new Error(
      `ElevenLabs request failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`,
    );
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('ElevenLabs returned an empty audio body.');
  }
  const url = URL.createObjectURL(blob);
  return { blob, url };
}
