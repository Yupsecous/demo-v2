import { AppError } from './errorMessages';

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
    throw new AppError('eleven/missing-key');
  }
  if (!args.voiceId) {
    throw new AppError('eleven/voice-not-found', 'empty voiceId');
  }
  if (!args.script.trim()) {
    throw new AppError('eleven/bad-response', 'empty script');
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
    throw new AppError('eleven/network', err instanceof Error ? err.message : 'fetch failed');
  }

  if (!res.ok) {
    if (res.status === 401) throw new AppError('eleven/auth-failed');
    if (res.status === 422) throw new AppError('eleven/voice-not-found');
    if (res.status === 404) throw new AppError('eleven/voice-not-found');
    if (res.status === 429) throw new AppError('eleven/rate-limit');
    const text = await res.text().catch(() => '');
    throw new AppError('eleven/bad-response', `status ${res.status}: ${text.slice(0, 200)}`);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new AppError('eleven/bad-response', 'empty audio body');
  }
  const url = URL.createObjectURL(blob);
  return { blob, url };
}
