import { useAppStore } from '../store';
import { applySamplePreset, type SamplePreset } from '../services/sampleLoader';

type Props = {
  sample: SamplePreset | null;
};

// Friendly first-impression card shown when no OpenAI key is configured.
// Replaces the brief form on cold load so a prospect doesn't land on a
// red error screen.

export function OnboardingState({ sample }: Props) {
  const openDrawer = useAppStore((s) => s.openDrawer);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-8">
      <p className="text-xs uppercase tracking-wider text-neutral-500">Welcome</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">A four-step ad workflow demo</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-700">
        This is a director&apos;s cockpit for marketing assets. You give a brief, then walk through
        copy, image, script, and audio — directing each step in plain English instead of writing
        prompts. To run it you&apos;ll need four API keys, one for each generation service we
        orchestrate.
      </p>

      <dl className="mt-6 space-y-3 text-sm">
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <dt className="font-medium text-neutral-900">OpenAI</dt>
          <dd className="text-neutral-600">Copy generation and direction translation</dd>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <dt className="font-medium text-neutral-900">fal.ai</dt>
          <dd className="text-neutral-600">Image generation (Flux Schnell)</dd>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <dt className="font-medium text-neutral-900">ElevenLabs</dt>
          <dd className="text-neutral-600">Voice synthesis</dd>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <dt className="font-medium text-neutral-900">Anthropic</dt>
          <dd className="text-neutral-600">Image critique (optional)</dd>
        </div>
      </dl>

      <p className="mt-6 text-xs leading-relaxed text-neutral-500">
        Click Settings to add them. Keys are stored in your browser session only — they&apos;re
        never sent to a server and they clear when you close this tab.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openDrawer}
          className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Open Settings
        </button>
        {sample && (
          <button
            type="button"
            onClick={() => applySamplePreset(sample)}
            className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Try the sample brief instead →
          </button>
        )}
      </div>
    </section>
  );
}
