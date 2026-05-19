import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { generateAudio } from '../services/audioService';
import { computeStepHash } from '../services/stepHash';
import {
  getDemoAudioVariant,
  loadSamplePreset,
  type SamplePreset,
} from '../services/sampleLoader';
import { WaveformPlayer } from './WaveformPlayer';
import { CacheRestorePill } from './CacheRestorePill';
import { InlineError } from './InlineError';
import { AppError } from '../services/errorMessages';
import { resolveVoice } from '../data/voiceLibrary';
import {
  audioVariantsOf,
  scriptVariantsOf,
  type AudioVariant,
  type RefineEntry,
} from '../types';

function isRestoredFromCache(history: RefineEntry[]): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!h) continue;
    if (h.kind === 'cache-restore') return true;
    if (h.kind === 'initial' || h.kind === 'more' || h.kind === 'refine') return false;
  }
  return false;
}

function newId(): string {
  return crypto.randomUUID();
}

// ErrorBanner replaced by shared <InlineError /> with plain-language strings.

function HistoryPanel({ history }: { history: RefineEntry[] }) {
  if (history.length === 0) return null;
  return (
    <details className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-neutral-700">
        Audio history ({history.length})
      </summary>
      <ol className="mt-3 space-y-2">
        {history.map((h, i) => (
          <li key={h.id} className="flex gap-3 text-neutral-700">
            <span className="font-mono text-xs text-neutral-400">{i + 1}.</span>
            <span className="flex-1">
              {h.kind === 'initial' && (
                <em className="not-italic text-neutral-500">Initial render</em>
              )}
              {h.kind === 'regenerate' && (
                <span>
                  Regenerated
                  {h.discardedDurationSeconds !== null && (
                    <span className="ml-2 text-xs text-neutral-500">
                      discarded ~{Math.round(h.discardedDurationSeconds)}s read
                    </span>
                  )}
                </span>
              )}
              {h.kind === 'cache-restore' && (
                <em className="not-italic text-neutral-500">Restored from earlier session</em>
              )}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function AudioStep() {
  const apiKey = useAppStore((s) => s.keys.eleven);
  const step = useAppStore((s) => s.steps.audio);
  const scriptStep = useAppStore((s) => s.steps.script);
  const setStepStatus = useAppStore((s) => s.setStepStatus);
  const appendVariants = useAppStore((s) => s.appendVariants);
  const replaceVariants = useAppStore((s) => s.replaceVariants);
  const addHistoryEntry = useAppStore((s) => s.addHistoryEntry);
  const pickVariant = useAppStore((s) => s.pickVariant);
  const restoreFromCache = useAppStore((s) => s.restoreFromCache);
  const openDrawer = useAppStore((s) => s.openDrawer);

  const variants = audioVariantsOf(step.variants);
  const current = variants[0];

  const [errorObj, setErrorObj] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [samplePreset, setSamplePreset] = useState<SamplePreset | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadSamplePreset().then((p) => {
      if (!cancelled) setSamplePreset(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const approvedScript =
    scriptStep.selectedIndex !== null
      ? scriptVariantsOf(scriptStep.variants)[scriptStep.selectedIndex]
      : undefined;
  const voice = resolveVoice(scriptStep.selectedVoiceId, scriptStep.history);

  function injectDemoVariant(): boolean {
    if (!samplePreset || !approvedScript || !voice) return false;
    const demo = getDemoAudioVariant(samplePreset);
    if (!demo) return false;
    if (current) URL.revokeObjectURL(current.audioUrl);
    const variant: AudioVariant = {
      kind: 'audio',
      id: newId(),
      audioUrl: demo.url,
      voiceId: voice.id,
      scriptId: approvedScript.id,
      ...(typeof demo.durationSeconds === 'number'
        ? { durationSeconds: demo.durationSeconds }
        : {}),
      createdAt: Date.now(),
    };
    replaceVariants('audio', [variant]);
    addHistoryEntry('audio', {
      id: newId(),
      kind: 'initial',
      direction: null,
      variantCount: 1,
      timestamp: Date.now(),
    });
    setStepStatus('audio', 'options');
    return true;
  }

  async function runGenerate(opts: { regenerate?: boolean } = {}) {
    if (!approvedScript || !voice) return;
    if (apiKey.trim().length === 0) {
      // Graceful degradation: if a sample preset is bundled, fall back to
      // its first audio so the demo doesn't dead-end. Banner makes the
      // substitution explicit.
      if (injectDemoVariant()) return;
      setErrorObj(new AppError('eleven/missing-key'));
      setStepStatus('audio', 'options');
      return;
    }
    setErrorObj(null);
    setIsGenerating(true);
    setStepStatus('audio', 'generating');
    const previousDuration = current?.durationSeconds ?? null;
    try {
      // free the previous object URL so we don't leak across regenerates
      if (current) {
        URL.revokeObjectURL(current.audioUrl);
      }
      const { blob, url } = await generateAudio({
        script: approvedScript.script,
        voiceId: voice.elevenlabsVoiceId,
        apiKey,
      });
      const variant: AudioVariant = {
        kind: 'audio',
        id: newId(),
        audioUrl: url,
        audioBlob: blob,
        voiceId: voice.id,
        scriptId: approvedScript.id,
        createdAt: Date.now(),
      };
      if (opts.regenerate) {
        replaceVariants('audio', [variant]);
        addHistoryEntry('audio', {
          id: newId(),
          kind: 'regenerate',
          discardedDurationSeconds: previousDuration,
          timestamp: Date.now(),
        });
      } else {
        appendVariants('audio', [variant]);
        addHistoryEntry('audio', {
          id: newId(),
          kind: 'initial',
          direction: null,
          variantCount: 1,
          timestamp: Date.now(),
        });
      }
      setStepStatus('audio', 'options');
    } catch (err) {
      setErrorObj(err);
      setStepStatus('audio', 'options');
    } finally {
      setIsGenerating(false);
    }
  }

  function approve() {
    if (current) pickVariant('audio', 0);
  }

  useEffect(() => {
    if (!approvedScript || !voice) return;
    if (
      step.status === 'generating' &&
      variants.length === 0 &&
      !attemptedRef.current &&
      !isGenerating
    ) {
      attemptedRef.current = true;
      const hash = computeStepHash(useAppStore.getState(), 'audio');
      if (restoreFromCache('audio', hash)) return;
      void runGenerate({ regenerate: false });
    }
    if (step.status !== 'generating') {
      attemptedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.status, variants.length, approvedScript?.id, voice?.id]);

  // Free the most recent object URL on unmount or when approving away from this step.
  useEffect(() => {
    return () => {
      const v = audioVariantsOf(useAppStore.getState().steps.audio.variants)[0];
      if (v) {
        // We intentionally do NOT revoke here — the FinalPackage view still
        // needs the URL to play. The blob and url live until the user starts
        // a new brief or closes the tab.
      }
    };
  }, []);

  if (!approvedScript || !voice) {
    return (
      <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Upstream selection missing.</p>
        <p className="mt-1">
          The audio step needs an approved script AND a picked voice. Reopen step 3 and complete both.
        </p>
      </section>
    );
  }

  const keyMissing = apiKey.trim().length === 0;
  const showGeneratingSkeleton = step.status === 'generating' || isGenerating;
  const restoredFromCache = isRestoredFromCache(step.history) && variants.length > 0;
  const isDemoAudio =
    current !== undefined && current.audioBlob === undefined &&
    current.audioUrl.includes('/samples/audio/');

  return (
    <section className="space-y-5">
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Audio</h2>
          <p className="mt-1 text-sm text-neutral-500">
            One final render. Approve to assemble the package, or regenerate for a different take.
          </p>
        </div>
        <span className="text-xs uppercase tracking-wide text-neutral-500">{step.status}</span>
      </header>

      {keyMissing && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">ElevenLabs key required</p>
          <p className="mt-1">Add your key in Settings to render the voiceover.</p>
          <button
            type="button"
            onClick={openDrawer}
            className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Open Settings
          </button>
        </div>
      )}

      {errorObj !== null && (
        <InlineError
          error={errorObj}
          onRetry={() => void runGenerate({ regenerate: !!current })}
        />
      )}

      {restoredFromCache && <CacheRestorePill />}

      {isDemoAudio && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
          Demo audio shown · add ElevenLabs key for live generation.
        </div>
      )}

      <article className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Script</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {approvedScript.script}
              </p>
            </div>
            <div className="border-t border-neutral-100 pt-4">
              {showGeneratingSkeleton && !current ? (
                <div className="space-y-2">
                  <div className="h-16 w-full animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
                </div>
              ) : current ? (
                <WaveformPlayer audioUrl={current.audioUrl} />
              ) : null}
            </div>
          </div>

          <aside className="space-y-4 rounded-md border border-neutral-100 bg-neutral-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Voice</p>
              <p className="mt-1 text-base font-semibold tracking-tight text-neutral-900">
                {voice.displayName}
              </p>
              <p className="text-xs text-neutral-500">{voice.toneLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Tone description</p>
              <p className="mt-1 text-sm text-neutral-800">{approvedScript.toneDescription}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Estimated duration</p>
              <p className="mt-1 font-mono text-sm text-neutral-800">
                ~{approvedScript.durationEstimate}s
              </p>
            </div>
          </aside>
        </div>

        {current && !showGeneratingSkeleton && (
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => void runGenerate({ regenerate: true })}
              disabled={isGenerating || keyMissing}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? 'Rendering…' : 'Regenerate'}
            </button>
            <button
              type="button"
              onClick={approve}
              className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Approve
            </button>
          </div>
        )}
      </article>

      <HistoryPanel history={step.history} />
    </section>
  );
}
