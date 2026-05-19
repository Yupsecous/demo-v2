import { useAppStore } from '../store';
import type { Brief, CachedStepState, VariantCache, Variant } from '../types';

export type SamplePreset = {
  brief: Brief;
  variantCache: VariantCache;
  audioCache: Record<string, CachedStepState>;
};

const PRESET_PATH = 'samples/preset.json';

function withBaseUrl(rawUrl: string): string {
  if (/^https?:/i.test(rawUrl)) return rawUrl;
  // Preset URLs are stored as "samples/images/x.png" — join with Vite's BASE_URL
  // so dev (BASE_URL = '/') and prod (BASE_URL = './') both resolve correctly.
  const base = import.meta.env.BASE_URL;
  return rawUrl.startsWith('/') ? `${base}${rawUrl.slice(1)}` : `${base}${rawUrl}`;
}

function rehydrateVariant(v: Variant): Variant {
  if (v.kind === 'image') {
    return { ...v, imageUrl: withBaseUrl(v.imageUrl) };
  }
  if (v.kind === 'audio') {
    return { ...v, audioUrl: withBaseUrl(v.audioUrl) };
  }
  return v;
}

function rehydrateCache(cache: VariantCache): VariantCache {
  const out: VariantCache = {};
  for (const [k, entry] of Object.entries(cache)) {
    out[k] = { ...entry, variants: entry.variants.map(rehydrateVariant) };
  }
  return out;
}

export async function loadSamplePreset(): Promise<SamplePreset | null> {
  try {
    const url = `${import.meta.env.BASE_URL}${PRESET_PATH}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return null;
    return (await res.json()) as SamplePreset;
  } catch {
    return null;
  }
}

// Returns the first audio variant in the preset (URL already absolutized
// against BASE_URL). Used by AudioStep when the live ElevenLabs path is
// unavailable but a preset is — keeps the demo from dead-ending.
export function getDemoAudioVariant(
  preset: SamplePreset,
): { url: string; durationSeconds?: number } | null {
  for (const entry of Object.values(preset.audioCache)) {
    for (const v of entry.variants) {
      if (v.kind === 'audio' && v.audioUrl) {
        return {
          url: withBaseUrl(v.audioUrl),
          ...(typeof v.durationSeconds === 'number'
            ? { durationSeconds: v.durationSeconds }
            : {}),
        };
      }
    }
  }
  return null;
}

export function applySamplePreset(preset: SamplePreset): void {
  const store = useAppStore;
  const rehydratedCache = rehydrateCache(preset.variantCache);
  const rehydratedAudio = rehydrateCache(preset.audioCache);

  store.setState((s) => ({
    brief: preset.brief,
    briefSubmitted: true,
    variantCache: { ...s.variantCache, ...rehydratedCache, ...rehydratedAudio },
  }));

  // beginFirstStep flips copy → 'generating'; the useEffect then computes
  // the hash, hits the preset's copy entry, restores → cascades through.
  store.getState().beginFirstStep();
}
