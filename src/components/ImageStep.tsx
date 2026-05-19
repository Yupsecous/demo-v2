import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { llmService } from '../services/llmService';
import { critiqueImage } from '../services/critiqueService';
import { computeStepHash } from '../services/stepHash';
import { CacheRestorePill } from './CacheRestorePill';
import {
  copyVariantsOf,
  imageVariantsOf,
  type Critique,
  type ImageVariant,
  type RefineEntry,
  type RefineKind,
} from '../types';

function isRestoredFromCache(history: RefineEntry[]): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!h) continue;
    if (h.kind === 'cache-restore') return true;
    if (
      h.kind === 'initial' ||
      h.kind === 'more' ||
      h.kind === 'refine' ||
      h.kind === 'critique-applied'
    )
      return false;
  }
  return false;
}

type LoadOp = null | 'initial' | 'more' | 'refine';

function newId(): string {
  return crypto.randomUUID();
}

function makeHistoryEntry(kind: RefineKind, direction: string | null, count: number): RefineEntry {
  return {
    id: newId(),
    kind,
    direction,
    variantCount: count,
    timestamp: Date.now(),
  };
}

function SkeletonImage() {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="aspect-[4/5] animate-pulse bg-gradient-to-br from-neutral-100 to-neutral-200" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="h-7 w-28 animate-pulse rounded bg-neutral-200" />
      </div>
    </div>
  );
}

function CritiqueBlock({
  variantId,
  critique,
  loading,
  error,
  onLoad,
  onApply,
  onClose,
}: {
  variantId: string;
  critique: Critique | undefined;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
  onApply: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="border-t border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Creative-director critique
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          Hide
        </button>
      </div>

      {loading && (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-9/12 animate-pulse rounded bg-neutral-200" />
        </div>
      )}

      {error && !loading && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Critique failed</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={onLoad}
            className="mt-2 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && critique && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-neutral-800">{critique.text}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onApply(critique.text)}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Apply this critique
            </button>
            <span className="text-xs text-neutral-500">
              Pipes the critique into the refine flow for variant{' '}
              <span className="font-mono">{variantId.slice(0, 6)}</span>.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function VariantCard({
  variant,
  index,
  total,
  isSelected,
  critique,
  critiqueDisabled,
  critiqueDisabledReason,
  onPick,
  onCritiqueLoad,
  onApplyCritique,
}: {
  variant: ImageVariant;
  index: number;
  total: number;
  isSelected: boolean;
  critique: Critique | undefined;
  critiqueDisabled?: boolean;
  critiqueDisabledReason?: string;
  onPick: () => void;
  onCritiqueLoad: () => Promise<void>;
  onApplyCritique: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      await onCritiqueLoad();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open) {
      setOpen(true);
      if (!critique && !loading) {
        void run();
      }
    } else {
      setOpen(false);
    }
  }

  return (
    <article
      className={`overflow-hidden rounded-lg border bg-white transition-colors ${
        isSelected ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-neutral-200'
      }`}
    >
      <div className="aspect-[4/5] bg-neutral-100">
        <img
          src={variant.imageUrl}
          alt={`Variant ${index + 1}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            Option {index + 1} of {total}
          </span>
          {isSelected && <span className="font-medium text-emerald-700">Selected</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPick}
            className="flex-1 rounded-md bg-neutral-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Pick this
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={critiqueDisabled && !critique}
            title={critiqueDisabled && !critique ? critiqueDisabledReason : undefined}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {open ? 'Hide critique' : critique ? 'Show critique' : 'Critique'}
          </button>
        </div>
      </div>
      {open && (
        <CritiqueBlock
          variantId={variant.id}
          critique={critique}
          loading={loading}
          error={error}
          onLoad={run}
          onApply={onApplyCritique}
          onClose={() => setOpen(false)}
        />
      )}
    </article>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">Generation failed</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Retry
      </button>
    </div>
  );
}

function HistoryPanel({ history }: { history: RefineEntry[] }) {
  if (history.length === 0) return null;
  return (
    <details className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-neutral-700">
        Direction history ({history.length})
      </summary>
      <ol className="mt-3 space-y-2">
        {history.map((h, i) => (
          <li key={h.id} className="flex gap-3 text-neutral-700">
            <span className="font-mono text-xs text-neutral-400">{i + 1}.</span>
            <span className="flex-1">
              {h.kind === 'initial' && (
                <em className="not-italic text-neutral-500">Initial generation</em>
              )}
              {h.kind === 'more' && (
                <em className="not-italic text-neutral-500">Asked for more variants</em>
              )}
              {h.kind === 'refine' && (
                <span>
                  Refined:{' '}
                  <span className="font-medium text-neutral-900">
                    &ldquo;{(h.direction ?? '').slice(0, 240)}
                    {(h.direction ?? '').length > 240 ? '…' : ''}&rdquo;
                  </span>
                </span>
              )}
              {h.kind === 'critique-applied' && (
                <span>
                  Applied critique:{' '}
                  <span className="font-medium text-neutral-900">
                    &ldquo;{(h.direction ?? '').slice(0, 160)}
                    {(h.direction ?? '').length > 160 ? '…' : ''}&rdquo;
                  </span>
                </span>
              )}
              {h.kind === 'cache-restore' && (
                <em className="not-italic text-neutral-500">Restored from earlier session</em>
              )}
              {(h.kind === 'initial' ||
                h.kind === 'more' ||
                h.kind === 'refine' ||
                h.kind === 'critique-applied') && (
                <span className="ml-2 text-xs text-neutral-500">+{h.variantCount}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function ImageStep() {
  const brief = useAppStore((s) => s.brief);
  const apiKeys = useAppStore((s) => s.keys);
  const step = useAppStore((s) => s.steps.image);
  const copyStep = useAppStore((s) => s.steps.copy);
  const setStepStatus = useAppStore((s) => s.setStepStatus);
  const appendVariants = useAppStore((s) => s.appendVariants);
  const replaceVariants = useAppStore((s) => s.replaceVariants);
  const addHistoryEntry = useAppStore((s) => s.addHistoryEntry);
  const setCritique = useAppStore((s) => s.setCritique);
  const pickVariant = useAppStore((s) => s.pickVariant);
  const restoreFromCache = useAppStore((s) => s.restoreFromCache);
  const openDrawer = useAppStore((s) => s.openDrawer);

  const variants = imageVariantsOf(step.variants);

  const [loading, setLoading] = useState<LoadOp>(null);
  const [errorState, setErrorState] = useState<{ op: LoadOp; message: string } | null>(null);
  const [refineText, setRefineText] = useState('');
  const initialAttemptedRef = useRef(false);

  const approvedCopy =
    copyStep.selectedIndex !== null
      ? copyVariantsOf(copyStep.variants)[copyStep.selectedIndex]
      : undefined;

  async function runInitial() {
    if (!approvedCopy) return;
    setErrorState(null);
    setLoading('initial');
    try {
      const next = await llmService.generateImages({
        brief,
        approvedCopy,
        count: 2,
        apiKeys: { openai: apiKeys.openai, fal: apiKeys.fal },
      });
      appendVariants('image', next);
      addHistoryEntry('image', makeHistoryEntry('initial', null, next.length));
      setStepStatus('image', 'options');
    } catch (err) {
      setErrorState({ op: 'initial', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  }

  async function runMore() {
    if (!approvedCopy) return;
    setErrorState(null);
    setLoading('more');
    try {
      const next = await llmService.generateImages({
        brief,
        approvedCopy,
        previousVariants: variants,
        count: 2,
        apiKeys: { openai: apiKeys.openai, fal: apiKeys.fal },
      });
      appendVariants('image', next);
      addHistoryEntry('image', makeHistoryEntry('more', null, next.length));
    } catch (err) {
      setErrorState({ op: 'more', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  }

  async function runRefine(
    directionText?: string,
    kind: 'refine' | 'critique-applied' = 'refine',
  ) {
    if (!approvedCopy) return;
    const direction = (directionText ?? refineText).trim();
    if (!direction) return;
    setErrorState(null);
    setLoading('refine');
    setStepStatus('image', 'refining');
    try {
      const next = await llmService.generateImages({
        brief,
        approvedCopy,
        previousVariants: variants,
        refineDirection: direction,
        count: 2,
        apiKeys: { openai: apiKeys.openai, fal: apiKeys.fal },
      });
      addHistoryEntry('image', makeHistoryEntry(kind, direction, next.length));
      replaceVariants('image', next);
      setStepStatus('image', 'options');
      if (!directionText) setRefineText('');
    } catch (err) {
      setErrorState({ op: 'refine', message: err instanceof Error ? err.message : String(err) });
      setStepStatus('image', 'options');
    } finally {
      setLoading(null);
    }
  }

  async function loadCritique(variant: ImageVariant) {
    if (!approvedCopy) {
      throw new Error('Approved copy is missing. Re-open the copy step and pick a variant.');
    }
    const text = await critiqueImage({
      variant,
      approvedCopy,
      brief,
      apiKey: apiKeys.anthropic,
    });
    const c: Critique = {
      variantId: variant.id,
      text,
      createdAt: Date.now(),
    };
    setCritique('image', variant.id, c);
  }

  useEffect(() => {
    if (!approvedCopy) return;
    if (
      step.status === 'generating' &&
      variants.length === 0 &&
      !initialAttemptedRef.current &&
      loading === null
    ) {
      initialAttemptedRef.current = true;
      const hash = computeStepHash(useAppStore.getState(), 'image');
      if (restoreFromCache('image', hash)) return;
      void runInitial();
    }
    if (step.status !== 'generating') {
      initialAttemptedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.status, variants.length, approvedCopy?.id]);

  if (!approvedCopy) {
    return (
      <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Approved copy missing.</p>
        <p className="mt-1">
          The image step opened without a selected copy variant. Re-open step 1 and pick one.
        </p>
      </section>
    );
  }

  const openaiMissing = apiKeys.openai.trim().length === 0;
  const falMissing = apiKeys.fal.trim().length === 0;
  const anthropicMissing = apiKeys.anthropic.trim().length === 0;
  const keysMissing = openaiMissing || falMissing;
  const showInitialSkeleton =
    (step.status === 'generating' || loading === 'initial') && variants.length === 0;
  const showRefineSkeleton = loading === 'refine';
  const showingSkeletons = showInitialSkeleton || showRefineSkeleton;
  const restoredFromCache = isRestoredFromCache(step.history) && variants.length > 0;

  return (
    <section className="space-y-5">
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Image</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Pick an image, ask for more, refine in plain English, or get a director&apos;s critique.
          </p>
        </div>
        <span className="text-xs uppercase tracking-wide text-neutral-500">{step.status}</span>
      </header>

      {keysMissing && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Keys required</p>
          <p className="mt-1">
            Image generation needs both an OpenAI key (prompt builder) and a fal.ai key
            (Flux Schnell). Add them in Settings.
          </p>
          <button
            type="button"
            onClick={openDrawer}
            className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Open Settings
          </button>
        </div>
      )}

      {errorState && errorState.op === 'initial' && (
        <ErrorBanner
          message={errorState.message}
          onRetry={() => {
            initialAttemptedRef.current = false;
            void runInitial();
          }}
        />
      )}

      {restoredFromCache && <CacheRestorePill />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {showingSkeletons ? (
          <>
            <SkeletonImage />
            <SkeletonImage />
          </>
        ) : (
          variants.map((v, i) => (
            <VariantCard
              key={v.id}
              variant={v}
              index={i}
              total={variants.length}
              isSelected={step.selectedIndex === i}
              critique={step.critiques[v.id]}
              onPick={() => pickVariant('image', i)}
              onCritiqueLoad={() => loadCritique(v)}
              onApplyCritique={(text) => void runRefine(text, 'critique-applied')}
              critiqueDisabled={anthropicMissing}
              critiqueDisabledReason="Add Anthropic key in Settings to enable critique."
            />
          ))
        )}
      </div>

      {variants.length > 0 && (
        <>
          {errorState && errorState.op !== 'initial' && (
            <ErrorBanner
              message={errorState.message}
              onRetry={() => {
                if (errorState.op === 'more') void runMore();
                if (errorState.op === 'refine') void runRefine();
              }}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runMore}
              disabled={loading !== null || keysMissing}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === 'more' ? 'Generating…' : 'Show me 2 more'}
            </button>
            <span className="text-xs text-neutral-500">
              {variants.length} variant{variants.length === 1 ? '' : 's'} so far
            </span>
            {anthropicMissing && (
              <span className="ml-auto text-xs text-amber-700">
                Anthropic key missing — critique disabled
              </span>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <label htmlFor="image-refine" className="text-sm font-medium text-neutral-800">
              Refine
            </label>
            <p className="mt-1 text-xs text-neutral-500">
              Describe a direction. Fresh images take its lead instead of editing the old ones.
            </p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <textarea
                id="image-refine"
                rows={2}
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="e.g. lighter background, the guy should smile more, more energy"
                disabled={loading !== null}
                className="flex-1 resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-50"
              />
              <button
                type="button"
                onClick={() => void runRefine()}
                disabled={loading !== null || refineText.trim().length === 0 || keysMissing}
                className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {loading === 'refine' ? 'Refining…' : 'Refine'}
              </button>
            </div>
          </div>
        </>
      )}

      <HistoryPanel history={step.history} />
    </section>
  );
}
