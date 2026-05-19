import { useState } from 'react';
import { useAppStore } from './store';
import { Stepper } from './components/Stepper';
import { SettingsDrawer } from './components/SettingsDrawer';
import { BriefForm } from './components/BriefForm';
import { StepShell } from './components/StepShell';
import { TranslatorHarness } from './components/TranslatorHarness';
import { computeStepHash } from './services/stepHash';
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
  const openDrawer = useAppStore((s) => s.openDrawer);
  const resetBrief = useAppStore((s) => s.resetBrief);
  const resetSteps = useAppStore((s) => s.resetSteps);

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

  return (
    <div className="min-h-full bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500">Demo v2</p>
            <h1 className="text-base font-semibold tracking-tight">Director&apos;s cockpit</h1>
          </div>
          <div className="flex items-center gap-2">
            {briefSubmitted && (
              <button
                type="button"
                onClick={restart}
                className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                New brief
              </button>
            )}
            <button
              type="button"
              onClick={openDrawer}
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Settings
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-4">
          <Stepper />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {briefSubmitted ? <StepShell /> : <BriefForm />}
        <DebugPanel />
      </main>

      <SettingsDrawer />
    </div>
  );
}
