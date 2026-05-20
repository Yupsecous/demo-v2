import { useAppStore } from '../store';
import { PROVIDER_LABELS, type Provider, type ValidationStatus } from '../types';

const PROVIDERS: Provider[] = ['fal', 'eleven', 'openai', 'anthropic'];

function StatusBadge({ status }: { status: ValidationStatus }) {
  const map: Record<ValidationStatus, { label: string; cls: string }> = {
    unchecked: { label: '—', cls: 'text-neutral-400 border-neutral-200' },
    validating: { label: '…', cls: 'text-neutral-500 border-neutral-300' },
    ok: { label: '✓', cls: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
    fail: { label: '✗', cls: 'text-red-700 border-red-300 bg-red-50' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${cls}`}>
      {label}
    </span>
  );
}

export function SettingsDrawer() {
  const open = useAppStore((s) => s.drawerOpen);
  const keys = useAppStore((s) => s.keys);
  const validations = useAppStore((s) => s.validations);
  const validating = useAppStore((s) => s.validating);
  const setKey = useAppStore((s) => s.setKey);
  const closeDrawer = useAppStore((s) => s.closeDrawer);
  const validateAll = useAppStore((s) => s.validateAll);
  const clearKeys = useAppStore((s) => s.clearKeys);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={closeDrawer}
        className={`fixed inset-0 z-30 bg-neutral-900/20 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        role="dialog"
        aria-label="Settings"
        className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Settings</h2>
            <p className="text-xs text-neutral-500">Keys are kept in this tab&apos;s sessionStorage only.</p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {PROVIDERS.map((p) => (
            <div key={p} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={`key-${p}`} className="text-sm font-medium text-neutral-800">
                  {PROVIDER_LABELS[p]}
                </label>
                <StatusBadge status={validations[p]} />
              </div>
              <input
                id={`key-${p}`}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keys[p]}
                onChange={(e) => setKey(p, e.target.value)}
                placeholder={`${PROVIDER_LABELS[p]} API key`}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono outline-none focus:border-neutral-900"
              />
            </div>
          ))}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 px-6 py-4">
          <button
            type="button"
            onClick={clearKeys}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={validateAll}
            disabled={validating}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:bg-ink-faint"
          >
            {validating ? 'Validating…' : 'Validate keys'}
          </button>
        </footer>
      </aside>
    </>
  );
}
