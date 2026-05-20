import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store';
import { Stepper } from './components/Stepper';
import { SettingsDrawer } from './components/SettingsDrawer';
import { BriefForm } from './components/BriefForm';
import { StepShell } from './components/StepShell';
import { OnboardingState } from './components/OnboardingState';
import { TranslatorHarness } from './components/TranslatorHarness';
import { computeStepHash } from './services/stepHash';
import { loadSamplePreset, type SamplePreset } from './services/sampleLoader';
import { STEP_ORDER, type RefineEntry, type StepId } from './types';

function isTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('test') === '1';
}

function lastGenerationKind(history: RefineEntry[]): RefineEntry['kind'] | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!h) continue;
    if (
      h.kind === 'initial' ||
      h.kind === 'more' ||
      h.kind === 'refine' ||
      h.kind === 'critique-applied' ||
      h.kind === 'cache-restore'
    ) {
      return h.kind;
    }
  }
  return null;
}

function HashReadout() {
  const state = useAppStore();
  const rows = STEP_ORDER.map((id: StepId) => {
    const step = state.steps[id];
    const isLocked = step.status === 'pending' && step.variants.length === 0;
    const hash = isLocked ? null : computeStepHash(state, id);
    const namespaceCount = Object.keys(state.variantCache).filter((k) =>
      k.startsWith(`${id}:`),
    ).length;
    const lastKind = lastGenerationKind(step.history);
    const source =
      step.variants.length === 0
        ? '—'
        : lastKind === 'cache-restore'
          ? 'cache hit'
          : 'fresh';
    return { id, hash, source, namespaceCount, status: step.status };
  });
  return (
    <table className="mt-2 w-full text-[11px] font-mono">
      <thead>
        <tr className="text-neutral-500">
          <th className="text-left font-normal">step</th>
          <th className="text-left font-normal">hash</th>
          <th className="text-left font-normal">status</th>
          <th className="text-left font-normal">source</th>
          <th className="text-left font-normal">cache entries</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="text-neutral-700">
            <td>{r.id}</td>
            <td>{r.hash ?? '—'}</td>
            <td>{r.status}</td>
            <td>{r.source}</td>
            <td>{r.namespaceCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DebugPanel() {
  const [open, setOpen] = useState(false);
  const state = useAppStore();
  const snapshot = {
    briefSubmitted: state.briefSubmitted,
    brief: state.brief,
    validations: state.validations,
    steps: Object.fromEntries(
      Object.entries(state.steps).map(([id, s]) => [
        id,
        {
          status: s.status,
          variants: s.variants.length,
          selectedIndex: s.selectedIndex,
          history: s.history.length,
        },
      ]),
    ),
  };
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="mt-8 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs"
    >
      <summary className="cursor-pointer select-none font-medium text-neutral-600">Debug</summary>
      <div className="mt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Step hashes (live)
        </p>
        <HashReadout />
      </div>
      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-700">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </details>
  );
}

export default function App() {
  const briefSubmitted = useAppStore((s) => s.briefSubmitted);
  const openaiKey = useAppStore((s) => s.keys.openai);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const resetBrief = useAppStore((s) => s.resetBrief);
  const resetSteps = useAppStore((s) => s.resetSteps);
  const [sample, setSample] = useState<SamplePreset | null>(null);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadSamplePreset().then((p) => {
      if (!cancelled) setSample(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // First-time auto-open of Settings drawer when the page loads with no
  // OpenAI key configured. Delay 600ms so the welcome card is visible
  // first. One-shot per session — sessionStorage-persisted ref means a
  // user who closes the drawer and refreshes isn't re-pestered.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (briefSubmitted) return;
    if (openaiKey.trim().length > 0) return;
    const flagKey = 'demo-v2-onboarding-shown';
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(flagKey)) return;
    const t = setTimeout(() => {
      autoOpenedRef.current = true;
      if (typeof window !== 'undefined') window.sessionStorage.setItem(flagKey, '1');
      openDrawer();
    }, 600);
    return () => clearTimeout(t);
  }, [briefSubmitted, openaiKey, openDrawer]);

  const restart = () => {
    resetBrief();
    resetSteps();
  };

  if (isTestMode()) {
    return (
      <>
        <TranslatorHarness />
        <SettingsDrawer />
      </>
    );
  }

  const hasOpenaiKey = openaiKey.trim().length > 0;
  const showOnboarding = !briefSubmitted && !hasOpenaiKey;

  return (
    <div className="min-h-full bg-white">
      <header className="border-b border-rule bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-baseline gap-3">
            <div className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <p className="font-serif text-lg font-medium tracking-tight text-ink">
              Director&apos;s Cockpit
            </p>
            <p className="hidden text-xs uppercase tracking-[0.18em] text-ink-faint sm:block">
              v2
            </p>
          </div>
          <div className="flex items-center gap-2">
            {briefSubmitted && (
              <button
                type="button"
                onClick={restart}
                className="rounded-md border border-rule px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink"
              >
                New brief
              </button>
            )}
            <button
              type="button"
              onClick={openDrawer}
              className="rounded-md border border-rule px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink"
            >
              Settings
            </button>
          </div>
        </div>
        {!showOnboarding && (
          <div className="mx-auto max-w-5xl px-6 pb-4">
            <Stepper />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {showOnboarding ? (
          <OnboardingState sample={sample} />
        ) : briefSubmitted ? (
          <StepShell />
        ) : (
          <BriefForm />
        )}
        <DebugPanel />
      </main>

      <SettingsDrawer />
    </div>
  );
}
