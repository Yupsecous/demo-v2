import { useState } from 'react';
import { useAppStore } from '../store';
import { downloadPackage } from '../services/exportService';
import { WaveformPlayer } from './WaveformPlayer';
import { DirectorsNotes } from './DirectorsNotes';
import { getVoiceById } from '../data/voiceLibrary';
import {
  audioVariantsOf,
  copyVariantsOf,
  imageVariantsOf,
  scriptVariantsOf,
} from '../types';

function scrollToStepper() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function FinalPackage() {
  const state = useAppStore();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadWarning, setDownloadWarning] = useState<string | null>(null);

  const copy = copyVariantsOf(state.steps.copy.variants)[state.steps.copy.selectedIndex ?? -1];
  const image = imageVariantsOf(state.steps.image.variants)[state.steps.image.selectedIndex ?? -1];
  const script = scriptVariantsOf(state.steps.script.variants)[state.steps.script.selectedIndex ?? -1];
  const audio = audioVariantsOf(state.steps.audio.variants)[state.steps.audio.selectedIndex ?? -1];
  const voice = getVoiceById(state.steps.script.selectedVoiceId);

  if (!copy || !image || !script || !audio || !voice) {
    return (
      <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Final package incomplete.</p>
        <p className="mt-1">
          One or more approved assets are missing. Re-approve the affected steps in the stepper.
        </p>
      </section>
    );
  }

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    setDownloadWarning(null);
    try {
      const result = await downloadPackage(state);
      if (result.imageWarning) {
        setDownloadWarning(result.imageWarning);
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Approved</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Final package</h2>
          <p className="mt-1 text-sm text-neutral-500">
            All four assets locked. Download the bundle or backtrack to any step to revise.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scrollToStepper}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Edit any step
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
          >
            {downloading ? 'Packaging…' : 'Download package'}
          </button>
        </div>
      </header>

      {downloadError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Download failed</p>
          <p className="mt-1">{downloadError}</p>
        </div>
      )}
      {downloadWarning && !downloadError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {downloadWarning}
        </div>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Copy</h3>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="grid grid-cols-[80px_1fr] items-baseline gap-3">
            <dt className="text-neutral-500">Headline</dt>
            <dd className="font-semibold text-neutral-900">{copy.headline}</dd>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-baseline gap-3">
            <dt className="text-neutral-500">Caption</dt>
            <dd className="text-neutral-800">{copy.caption}</dd>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-baseline gap-3">
            <dt className="text-neutral-500">CTA</dt>
            <dd>
              <span className="inline-flex rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700">
                {copy.cta}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Image</h3>
        <div className="mt-3 overflow-hidden rounded-md border border-neutral-200">
          <img
            src={image.imageUrl}
            alt="Approved marketing image"
            className="w-full object-cover"
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Voiceover</h3>
        <div className="mt-3 grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Script</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                {script.script}
              </p>
            </div>
            <div className="border-t border-neutral-100 pt-4">
              <WaveformPlayer audioUrl={audio.audioUrl} />
            </div>
          </div>
          <aside className="space-y-3 rounded-md border border-neutral-100 bg-neutral-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Voice</p>
              <p className="mt-1 text-base font-semibold tracking-tight text-neutral-900">
                {voice.displayName}
              </p>
              <p className="text-xs text-neutral-500">{voice.toneLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Tone</p>
              <p className="mt-1 text-sm text-neutral-800">{script.toneDescription}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Director&apos;s notes
        </h3>
        <div className="mt-4">
          <DirectorsNotes />
        </div>
      </section>
    </article>
  );
}
