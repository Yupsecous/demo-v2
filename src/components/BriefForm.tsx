import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { applySamplePreset, loadSamplePreset, type SamplePreset } from '../services/sampleLoader';
import type { Brief } from '../types';

type FieldKey = keyof Brief;

const FIELDS: { key: FieldKey; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'productName', label: 'Product name', placeholder: 'e.g. Lumen Sleep Mist' },
  { key: 'targetAudience', label: 'Target audience', placeholder: 'e.g. Burned-out parents, 30–45' },
  { key: 'adAngle', label: 'Ad angle', placeholder: 'e.g. Fall asleep in seven minutes flat', multiline: true },
];

export function BriefForm() {
  const brief = useAppStore((s) => s.brief);
  const setBriefField = useAppStore((s) => s.setBriefField);
  const submitBrief = useAppStore((s) => s.submitBrief);
  const beginFirstStep = useAppStore((s) => s.beginFirstStep);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [sample, setSample] = useState<SamplePreset | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSamplePreset().then((p) => {
      if (!cancelled) setSample(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<FieldKey, string>> = {};
    for (const { key, label } of FIELDS) {
      if (brief[key].trim().length === 0) {
        next[key] = `${label} is required.`;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (submitBrief()) {
      beginFirstStep();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">The brief</p>
        <h1 className="font-serif mt-2 text-3xl font-medium leading-tight tracking-tight text-ink">
          Three lines, four assets.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          The director&apos;s cockpit will walk you through copy, image, script, and audio — one at
          a time.
        </p>
      </header>

      {sample && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-neutral-800">First time? Try the sample brief.</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Pre-cached run for <span className="font-medium text-neutral-700">{sample.brief.productName}</span>. The
              whole pipeline restores instantly — see the shape of the tool, then write your own.
            </p>
          </div>
          <button
            type="button"
            onClick={() => applySamplePreset(sample)}
            className="rounded-md border border-neutral-300 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Try sample brief &amp; explore →
          </button>
        </div>
      )}

      {FIELDS.map(({ key, label, placeholder, multiline }) => (
        <div key={key} className="space-y-1.5">
          <label htmlFor={`brief-${key}`} className="text-sm font-medium text-neutral-800">
            {label}
          </label>
          {multiline ? (
            <textarea
              id={`brief-${key}`}
              rows={3}
              value={brief[key]}
              onChange={(e) => setBriefField(key, e.target.value)}
              placeholder={placeholder}
              className="w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          ) : (
            <input
              id={`brief-${key}`}
              type="text"
              value={brief[key]}
              onChange={(e) => setBriefField(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          )}
          {errors[key] && <p className="text-xs text-red-600">{errors[key]}</p>}
        </div>
      ))}

      <div className="pt-2">
        <button
          type="submit"
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Start
        </button>
      </div>
    </form>
  );
}
