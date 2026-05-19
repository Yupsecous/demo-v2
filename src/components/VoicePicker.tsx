import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { VOICE_LIBRARY, VOICE_SAMPLE_SENTENCE, type VoiceSample } from '../data/voiceLibrary';
import { fetchUserVoices } from '../services/voicesService';

const BASE = import.meta.env.BASE_URL;

function sampleUrl(v: VoiceSample): string | null {
  if (!v.sampleMp3) return null;
  return `${BASE}${v.sampleMp3}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M4 3.5v9l8-4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="4" y="3.5" width="3" height="9" fill="currentColor" />
      <rect x="9" y="3.5" width="3" height="9" fill="currentColor" />
    </svg>
  );
}

type VoicesSource = 'loading' | 'user-account' | 'hardcoded';

export function VoicePicker({
  onSelect,
}: {
  onSelect: (voice: VoiceSample) => void;
}) {
  const elevenKey = useAppStore((s) => s.keys.eleven);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceSample[]>(VOICE_LIBRARY);
  const [source, setSource] = useState<VoicesSource>('loading');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [libraryReady, setLibraryReady] = useState<boolean | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // Prefer the user's actual ElevenLabs voices — the hardcoded library
  // uses legacy IDs that new accounts no longer get by default. Fall back
  // to hardcoded if the fetch fails or no key is set.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!elevenKey.trim()) {
        if (!cancelled) {
          setVoices(VOICE_LIBRARY);
          setSource('hardcoded');
        }
        return;
      }
      try {
        const fetched = await fetchUserVoices(elevenKey);
        if (cancelled) return;
        if (fetched.length === 0) {
          setVoices(VOICE_LIBRARY);
          setSource('hardcoded');
        } else {
          setVoices(fetched);
          setSource('user-account');
        }
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : String(err));
        setVoices(VOICE_LIBRARY);
        setSource('hardcoded');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [elevenKey]);

  // Probe one of the hardcoded sample MP3s. Only relevant when we're
  // showing the hardcoded library (the user-account voices have no
  // prerecorded samples by design).
  useEffect(() => {
    let cancelled = false;
    if (source !== 'hardcoded') {
      setLibraryReady(null);
      return;
    }
    async function probe() {
      const first = VOICE_LIBRARY[0];
      const url = first ? sampleUrl(first) : null;
      if (!url) {
        setLibraryReady(false);
        return;
      }
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!cancelled) setLibraryReady(res.ok);
      } catch {
        if (!cancelled) setLibraryReady(false);
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = '';
      }
    };
  }, []);

  function stop() {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlayingId(null);
  }

  function play(voice: VoiceSample) {
    const url = sampleUrl(voice);
    if (!url) return;
    let a = audioRef.current;
    if (!a) {
      a = new Audio();
      a.preload = 'none';
      a.addEventListener('ended', () => setPlayingId(null));
      a.addEventListener('error', () => {
        setPlayingId(null);
        setCardErrors((e) => ({
          ...e,
          [voice.id]: "Preview couldn't load. You can still select this voice — the final render will use it.",
        }));
      });
      audioRef.current = a;
    }
    a.pause();
    a.src = url;
    setCardErrors((e) => {
      const next = { ...e };
      delete next[voice.id];
      return next;
    });
    a.play()
      .then(() => setPlayingId(voice.id))
      .catch(() => {
        setPlayingId(null);
        setCardErrors((e) => ({
          ...e,
          [voice.id]: "Preview couldn't load. You can still select this voice — the final render will use it.",
        }));
      });
  }

  function toggle(voice: VoiceSample) {
    if (playingId === voice.id) {
      stop();
    } else {
      play(voice);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Pick a voice</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {source === 'user-account'
              ? 'Pulled from your ElevenLabs account — these are the voices the final render can actually use.'
              : (
                <>
                  Each sample reads:{' '}
                  <em className="not-italic text-neutral-700">&ldquo;{VOICE_SAMPLE_SENTENCE}&rdquo;</em>
                </>
              )}
          </p>
        </div>
        <span className="text-xs text-neutral-500">
          {voices.length} voice{voices.length === 1 ? '' : 's'}
        </span>
      </header>

      {source === 'hardcoded' && fetchError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-medium">Couldn&apos;t load voices from your ElevenLabs account.</p>
          <p className="mt-1">
            {fetchError} — using the demo&apos;s built-in voice library. If the final render fails with
            <code className="mx-1 font-mono">voice_not_found</code>, add the chosen voice to your account
            at{' '}
            <a
              href="https://elevenlabs.io/app/voice-library"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              ElevenLabs Voice Library
            </a>
            .
          </p>
        </div>
      )}

      {source === 'hardcoded' && libraryReady === false && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
          Voice previews are loading. If they don&apos;t appear, refresh the page or open Settings to
          add your ElevenLabs key — the picker will then use your account&apos;s voices directly.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {voices.map((voice) => {
          const isPlaying = playingId === voice.id;
          const err = cardErrors[voice.id];
          const hasSample = sampleUrl(voice) !== null;
          return (
            <article
              key={voice.id}
              className={`flex flex-col rounded-lg border bg-white p-4 transition-colors ${
                isPlaying ? 'border-neutral-900' : 'border-neutral-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-semibold tracking-tight">{voice.displayName}</h4>
                  <p className="mt-0.5 text-xs text-neutral-500">{voice.toneLabel}</p>
                </div>
                {hasSample && (
                  <button
                    type="button"
                    onClick={() => toggle(voice)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-neutral-700 transition-colors ${
                      isPlaying
                        ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800'
                        : 'border-neutral-300 bg-white hover:bg-neutral-50'
                    }`}
                    aria-label={isPlaying ? `Pause ${voice.displayName}` : `Play ${voice.displayName}`}
                  >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                )}
              </div>

              {err && <p className="mt-3 text-xs text-amber-700">{err}</p>}

              <button
                type="button"
                onClick={() => onSelect(voice)}
                className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Select this voice
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
