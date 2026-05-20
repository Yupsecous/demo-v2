import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { translateDirection } from '../services/translator';
import { ASSET_TYPES, type AssetType, type TranslatorOutput } from '../types';

const DIRECTIONS: readonly string[] = [
  'more aggressive',
  'more aggressive, less corporate',
  'lighter background, more energy',
  'darker, more dramatic',
  'calmer, more grounded',
  'softer, more friendly',
  'punchier',
  'the guy should smile more',
  'more cinematic',
  'less stocky, more candid',
  'more confident, less salesy',
  'warmer tone overall',
  'cooler, more clinical',
  'more urgent, scarcity',
  'playful, light',
  'minimalist, restraint',
  'high-fashion editorial',
  'more aspirational',
  'make it pop',
  'tone down the energy',
] as const;

const CHUNK_SIZE = 10;

type CellKey = `${number}-${AssetType}`;
type CellStatus = 'pending' | 'running' | 'ok' | 'fail';
type CellState = {
  status: CellStatus;
  output?: TranslatorOutput;
  error?: string;
  ms?: number;
};

function cellKey(idx: number, type: AssetType): CellKey {
  return `${idx}-${type}`;
}

function emptyCells(): Record<CellKey, CellState> {
  const cells: Record<string, CellState> = {};
  DIRECTIONS.forEach((_, i) => {
    ASSET_TYPES.forEach((t) => {
      cells[cellKey(i, t)] = { status: 'pending' };
    });
  });
  return cells;
}

function StatusPill({ status, ms }: { status: CellStatus; ms?: number }) {
  const map: Record<CellStatus, { label: string; cls: string }> = {
    pending: { label: 'pending', cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
    running: { label: 'running…', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    ok: { label: ms ? `${ms}ms ✓` : '✓', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    fail: { label: ms ? `${ms}ms ✗` : '✗', cls: 'bg-red-50 text-red-700 border-red-300' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] ${cls}`}>
      {label}
    </span>
  );
}

function Cell({ state }: { state: CellState }) {
  if (state.status === 'pending') {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-400">
        <StatusPill status="pending" />
      </div>
    );
  }
  if (state.status === 'running') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50/30 p-3 text-xs animate-pulse">
        <StatusPill status="running" />
      </div>
    );
  }
  if (state.status === 'fail') {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs">
        <StatusPill status="fail" ms={state.ms} />
        <p className="mt-2 text-red-700">{state.error}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-emerald-300 bg-emerald-50/40 p-3 text-xs">
      <StatusPill status="ok" ms={state.ms} />
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-snug text-neutral-800">
        {JSON.stringify(state.output?.mods ?? null, null, 2)}
      </pre>
    </div>
  );
}

export function TranslatorHarness() {
  const apiKey = useAppStore((s) => s.keys.openai);
  const openDrawer = useAppStore((s) => s.openDrawer);

  const [cells, setCells] = useState<Record<CellKey, CellState>>(emptyCells);
  const [running, setRunning] = useState(false);

  const stats = useMemo(() => {
    const all = Object.values(cells);
    return {
      done: all.filter((c) => c.status === 'ok' || c.status === 'fail').length,
      ok: all.filter((c) => c.status === 'ok').length,
      fail: all.filter((c) => c.status === 'fail').length,
      total: all.length,
    };
  }, [cells]);

  function setCell(key: CellKey, next: CellState) {
    setCells((prev) => ({ ...prev, [key]: next }));
  }

  async function runAll() {
    if (running) return;
    if (apiKey.trim().length === 0) return;
    setRunning(true);
    setCells(emptyCells());

    const tasks: { key: CellKey; direction: string; type: AssetType }[] = [];
    DIRECTIONS.forEach((direction, i) => {
      ASSET_TYPES.forEach((type) => {
        tasks.push({ key: cellKey(i, type), direction, type });
      });
    });

    for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
      const chunk = tasks.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (t) => {
          setCell(t.key, { status: 'running' });
          const start = performance.now();
          try {
            const output = await translateDirection({
              direction: t.direction,
              assetType: t.type,
              apiKey,
            });
            const ms = Math.round(performance.now() - start);
            setCell(t.key, { status: 'ok', output, ms });
          } catch (err) {
            const ms = Math.round(performance.now() - start);
            setCell(t.key, {
              status: 'fail',
              error: err instanceof Error ? err.message : String(err),
              ms,
            });
          }
        }),
      );
    }

    setRunning(false);
  }

  const apiKeyMissing = apiKey.trim().length === 0;

  return (
    <div className="min-h-full bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500">Demo v2 / Day 3</p>
            <h1 className="text-base font-semibold tracking-tight">Translator harness</h1>
            <p className="mt-1 text-xs text-neutral-500">
              20 directions × 3 asset types = 60 cells. Green = Zod parsed, red = failed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-neutral-600">
              {stats.done}/{stats.total} done · {stats.ok} ok · {stats.fail} fail
            </span>
            <a
              href="/"
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Back to demo
            </a>
            <button
              type="button"
              onClick={runAll}
              disabled={running || apiKeyMissing}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-ink-faint"
            >
              {running ? 'Running…' : 'Run all'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {apiKeyMissing && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">OpenAI key required</p>
            <p className="mt-1">Add your key in Settings to run the harness.</p>
            <button
              type="button"
              onClick={openDrawer}
              className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              Open Settings
            </button>
          </div>
        )}

        <div className="grid grid-cols-[220px_1fr_1fr_1fr] gap-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <div className="px-3 py-2">Direction</div>
          <div className="px-3 py-2">Copy</div>
          <div className="px-3 py-2">Image</div>
          <div className="px-3 py-2">Voice</div>
        </div>

        <div className="space-y-3">
          {DIRECTIONS.map((direction, i) => (
            <div key={i} className="grid grid-cols-[220px_1fr_1fr_1fr] gap-3">
              <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm font-medium text-neutral-800">
                <span className="block font-mono text-[10px] text-neutral-400">#{i + 1}</span>
                {direction}
              </div>
              {ASSET_TYPES.map((type) => (
                <Cell key={type} state={cells[cellKey(i, type)] ?? { status: 'pending' }} />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
