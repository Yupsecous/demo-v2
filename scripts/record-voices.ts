// One-time recording of the voice library.
// Usage: ELEVENLABS_API_KEY=sk_... npm run record-voices
// Re-run with --force to overwrite existing MP3s.
//
// MP3s land in public/voices/. The browser then serves them as static assets;
// the demo never hits ElevenLabs at runtime for tone preview.

import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { VOICE_LIBRARY, VOICE_SAMPLE_SENTENCE } from '../src/data/voiceLibrary';

const apiKey = process.env.ELEVENLABS_API_KEY;
const force = process.argv.includes('--force');

if (!apiKey) {
  console.error('ELEVENLABS_API_KEY env var is required.');
  process.exit(1);
}

const OUT_DIR = 'public/voices';
const MODEL = 'eleven_turbo_v2_5';

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  let failures = 0;
  for (const voice of VOICE_LIBRARY) {
    const out = join(OUT_DIR, `${voice.id}.mp3`);
    if (!force && (await exists(out))) {
      console.log(`[skip] ${voice.id} (exists — pass --force to overwrite)`);
      continue;
    }

    process.stdout.write(`[fetch] ${voice.id} (${voice.displayName})... `);
    let res: Response;
    try {
      res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenlabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'content-type': 'application/json',
            accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: VOICE_SAMPLE_SENTENCE,
            model_id: MODEL,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        },
      );
    } catch (err) {
      console.error(`network error: ${err instanceof Error ? err.message : err}`);
      failures += 1;
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`FAILED ${res.status} ${body.slice(0, 200)}`);
      failures += 1;
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(out, buf);
    console.log(`ok (${buf.length} bytes → ${out})`);
  }

  if (failures > 0) {
    console.error(`\n${failures} voice${failures === 1 ? '' : 's'} failed.`);
    process.exitCode = 1;
  } else {
    console.log('\nVoice library ready.');
  }
}

await main();
