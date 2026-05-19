import { useEffect, useRef, useState } from 'react';
import { VOICE_LIBRARY, VOICE_SAMPLE_SENTENCE, type VoiceSample } from '../data/voiceLibrary';

const BASE = import.meta.env.BASE_URL;

function sampleUrl(v: VoiceSample): string {
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

export function VoicePicker({
  onSelect,
}: {
  onSelect: (voice: VoiceSample) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [libraryReady, setLibraryReady] = useState<boolean | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      const first = VOICE_LIBRARY[0];
      if (!first) {
        setLibraryReady(false);
        return;
      }
      try {
        const res = await fetch(sampleUrl(first), { method: 'HEAD' });
        if (!cancelled) setLibraryReady(res.ok);
      } catch {
        if (!cancelled) setLibraryReady(false);
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

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
    let a = audioRef.current;
    if (!a) {
      a = new Audio();
      a.preload = 'none';
      a.addEventListener('ended', () => setPlayingId(null));
      a.addEventListener('error', () => {
        setPlayingId(null);
        setCardErrors((e) => ({
          ...e,
          [voice.id]: 'Sample failed to load. Run "npm run record-voices" first.',
        }));
      });
      audioRef.current = a;
    }
    a.pause();
    a.src = sampleUrl(voice);
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
          [voice.id]: 'Sample failed to load. Run "npm run record-voices" first.',
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
            Each sample reads: <em className="not-italic text-neutral-700">&ldquo;{VOICE_SAMPLE_SENTENCE}&rdquo;</em>
          </p>
        </div>
        <span className="text-xs text-neutral-500">
          The final read uses your approved script — D6 renders the full audio.
        </span>
      </header>

      {libraryReady === false && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Voice library not recorded yet.</p>
          <p className="mt-1">
            Run <code className="font-mono">npm run record-voices</code> once with your ElevenLabs key in{' '}
            <code className="font-mono">ELEVENLABS_API_KEY</code>. MP3s land in{' '}
            <code className="font-mono">public/voices/</code> and the demo serves them as static assets.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VOICE_LIBRARY.map((voice) => {
          const isPlaying = playingId === voice.id;
          const err = cardErrors[voice.id];
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
