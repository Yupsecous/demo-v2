// Bake a fully-completed demo run into a static, self-contained sample preset.
//
// Workflow:
//   1. Run the demo end-to-end in dev with the chosen sample brief.
//   2. In DevTools console:
//        copy(JSON.stringify(useAppStore.getState()))
//      Paste the JSON into samples/source-state.json.
//   3. Download the audio MP3 via the FinalPackage "Download package" button.
//      Rename voiceover.mp3 to <audioVariantId>.mp3 (the variant id is
//      visible in the source-state.json under variantCache "audio:..." entries).
//      Drop the renamed file at samples/audio/<audioVariantId>.mp3.
//   4. Run: npm run bake-sample
//
// Result:
//   public/samples/preset.json       — { brief, variantCache, audioCache }
//   public/samples/images/<id>.<ext> — local copies of every cached image
//   public/samples/audio/<id>.mp3    — local copies of every audio variant
//
// The runtime fetches /samples/preset.json on app boot. If present, the
// "Try sample brief" button renders on BriefForm. Click → cache injection
// → cascade restores every step in milliseconds. Zero API calls.

import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE = 'samples/source-state.json';
const AUDIO_SRC_DIR = 'samples/audio';
const OUT_DIR = 'public/samples';
const OUT_IMAGES = 'public/samples/images';
const OUT_AUDIO = 'public/samples/audio';
const OUT_PRESET = 'public/samples/preset.json';

type Anything = Record<string, unknown>;

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function detectExtension(contentType: string | null): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

async function downloadImage(
  url: string,
  outDir: string,
  variantId: string,
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  [fail] ${variantId} (${url}) → ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = detectExtension(res.headers.get('content-type'));
    const filename = `${variantId}.${ext}`;
    await writeFile(join(outDir, filename), buf);
    console.log(`  [ok]  ${variantId} → ${filename} (${buf.length} bytes)`);
    return `samples/images/${filename}`;
  } catch (err) {
    console.error(
      `  [err] ${variantId}: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

async function copyAudio(variantId: string): Promise<string | null> {
  const src = join(AUDIO_SRC_DIR, `${variantId}.mp3`);
  if (!(await pathExists(src))) {
    console.error(
      `  [missing] expected ${src} for audio variant ${variantId} — drop the MP3 there and re-run`,
    );
    return null;
  }
  const dst = join(OUT_AUDIO, `${variantId}.mp3`);
  await copyFile(src, dst);
  console.log(`  [ok]  audio ${variantId} → ${dst}`);
  return `samples/audio/${variantId}.mp3`;
}

async function main(): Promise<void> {
  if (!(await pathExists(SOURCE))) {
    console.error(`${SOURCE} not found. See the comment at the top of this script.`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(OUT_IMAGES, { recursive: true });
  await mkdir(OUT_AUDIO, { recursive: true });

  const raw = await readFile(SOURCE, 'utf8');
  const parsed = JSON.parse(raw) as Anything;
  // sessionStorage shape is { state: {...}, version: N }; raw state is also accepted
  const state = (parsed.state ?? parsed) as Anything;

  const brief = state.brief;
  const cache = (state.variantCache ?? {}) as Record<string, Anything>;

  if (!brief) {
    console.error('source-state.json is missing `brief` — re-export the state after submitting the brief.');
    process.exit(1);
  }

  console.log('Brief:', brief);

  const outVariantCache: Record<string, Anything> = {};
  const outAudioCache: Record<string, Anything> = {};
  let imageCount = 0;
  let audioCount = 0;

  for (const [key, entry] of Object.entries(cache)) {
    const stepId = key.split(':')[0];
    const variants = ((entry as Anything).variants ?? []) as Anything[];

    if (stepId === 'image') {
      console.log(`\n[image cache key ${key}] ${variants.length} variant(s)`);
      const newVariants: Anything[] = [];
      for (const v of variants) {
        const id = String(v.id ?? '');
        const url = String(v.imageUrl ?? '');
        if (!id || !url) {
          newVariants.push(v);
          continue;
        }
        if (url.startsWith('samples/') || url.startsWith('/samples/')) {
          newVariants.push(v); // already baked
          continue;
        }
        const localPath = await downloadImage(url, OUT_IMAGES, id);
        if (localPath) {
          newVariants.push({ ...v, imageUrl: localPath });
          imageCount += 1;
        } else {
          newVariants.push(v);
        }
      }
      outVariantCache[key] = { ...entry, variants: newVariants };
    } else if (stepId === 'audio') {
      console.log(`\n[audio cache key ${key}] ${variants.length} variant(s)`);
      const newVariants: Anything[] = [];
      for (const v of variants) {
        const id = String(v.id ?? '');
        if (!id) {
          newVariants.push(v);
          continue;
        }
        const localPath = await copyAudio(id);
        if (localPath) {
          // Drop audioBlob (won't serialize anyway); set local audioUrl
          const { audioBlob: _drop, ...rest } = v as Anything & { audioBlob?: unknown };
          newVariants.push({ ...rest, audioUrl: localPath });
          audioCount += 1;
        } else {
          newVariants.push(v);
        }
      }
      outAudioCache[key] = { ...entry, variants: newVariants };
    } else {
      // copy, script — pass through unchanged
      outVariantCache[key] = entry;
    }
  }

  const preset = {
    brief,
    variantCache: outVariantCache,
    audioCache: outAudioCache,
  };

  await writeFile(OUT_PRESET, JSON.stringify(preset, null, 2));
  console.log(`\nWrote ${OUT_PRESET}`);
  console.log(`Images baked: ${imageCount} · Audio baked: ${audioCount}`);
  console.log(`Cache entries: copy/script=${Object.keys(outVariantCache).filter((k) => !k.startsWith('image:')).length}, image=${Object.keys(outVariantCache).filter((k) => k.startsWith('image:')).length}, audio=${Object.keys(outAudioCache).length}`);
}

await main();
