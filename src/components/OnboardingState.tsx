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
    <section className="paper-surface rounded-xl border border-rule p-10 md:p-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Welcome</p>
      <h1 className="font-serif mt-4 text-4xl font-medium leading-[1.1] tracking-tight text-ink md:text-5xl">
        A four-step ad workflow,<br />directed by you.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
        This is a director&apos;s cockpit for marketing assets. You give a brief, then walk through
        copy, image, script, and audio — directing each step in plain English instead of writing
        prompts. To run it you&apos;ll need four API keys, one for each generation service we
        orchestrate.
      </p>

      <dl className="mt-8 max-w-xl divide-y divide-rule border-y border-rule">
        <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-3">
          <dt className="font-serif text-sm font-medium text-ink">OpenAI</dt>
          <dd className="text-sm text-ink-soft">Copy generation and direction translation</dd>
        </div>
        <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-3">
          <dt className="font-serif text-sm font-medium text-ink">fal.ai</dt>
          <dd className="text-sm text-ink-soft">Image generation (Flux Schnell)</dd>
        </div>
        <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-3">
          <dt className="font-serif text-sm font-medium text-ink">ElevenLabs</dt>
          <dd className="text-sm text-ink-soft">Voice synthesis</dd>
        </div>
        <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 py-3">
          <dt className="font-serif text-sm font-medium text-ink">Anthropic</dt>
          <dd className="text-sm text-ink-soft">
            Image critique and (optional) higher-quality copy via Claude Sonnet
          </dd>
        </div>
      </dl>

      <p className="mt-6 max-w-xl text-xs leading-relaxed text-ink-faint">
        Keys are stored in your browser session only — they&apos;re never sent to a server and they
        clear when you close this tab.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openDrawer}
          className="rounded-md bg-brand px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
        >
          Open Settings →
        </button>
        {sample && (
          <button
            type="button"
            onClick={() => applySamplePreset(sample)}
            className="rounded-md border border-rule-strong bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-canvas-deep"
          >
            Try the sample brief instead
          </button>
        )}
      </div>
    </section>
  );
}
