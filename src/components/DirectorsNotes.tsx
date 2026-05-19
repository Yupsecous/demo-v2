import { useAppStore } from '../store';
import { buildDirectorsNotesData } from '../services/directorsNotes';

function RefinementList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">No refinements — picked the first read.</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm text-neutral-800">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className="font-mono text-xs text-neutral-400">{i + 1}.</span>
          <span>
            <span className="text-neutral-500">pushed for </span>
            <span className="font-medium text-neutral-900">{s.length > 240 ? s.slice(0, 240).trimEnd() + '…' : s}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DirectorsNotes() {
  const state = useAppStore();
  const d = buildDirectorsNotesData(state);

  return (
    <section className="space-y-6 text-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Brief</h3>
        <dl className="mt-2 grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
          <dt className="text-neutral-500">Product</dt>
          <dd className="text-neutral-900">{d.brief.productName}</dd>
          <dt className="text-neutral-500">Audience</dt>
          <dd className="text-neutral-900">{d.brief.targetAudience}</dd>
          <dt className="text-neutral-500">Angle</dt>
          <dd className="text-neutral-900">{d.brief.adAngle}</dd>
        </dl>
      </div>

      {d.copy && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Copy</h3>
          <p className="mt-2 text-neutral-800">
            Approved variant <span className="font-mono">#{d.copy.approvedIndex + 1}</span>:{' '}
            <span className="font-medium text-neutral-900">&ldquo;{d.copy.headline}&rdquo;</span>
          </p>
          <div className="mt-3">
            <p className="text-xs font-medium text-neutral-600">Refinements</p>
            <div className="mt-1.5">
              <RefinementList items={d.copy.refinements} />
            </div>
          </div>
        </div>
      )}

      {d.image && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Image</h3>
          <p className="mt-2 text-neutral-800">
            Approved variant <span className="font-mono">#{d.image.approvedIndex + 1}</span>.
          </p>
          <div className="mt-3">
            <p className="text-xs font-medium text-neutral-600">Refinements</p>
            <div className="mt-1.5">
              <RefinementList items={d.image.refinements} />
            </div>
          </div>
          {d.image.appliedCritiques.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-neutral-600">Critiques applied</p>
              <ul className="mt-1.5 space-y-2 text-sm text-neutral-800">
                {d.image.appliedCritiques.map((c, i) => (
                  <li key={i} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-neutral-700">
                      {c.length > 280 ? c.slice(0, 280).trimEnd() + '…' : c}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {d.script && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Script + Voice
          </h3>
          <p className="mt-2 text-neutral-800">
            Approved variant <span className="font-mono">#{d.script.approvedIndex + 1}</span>:{' '}
            <span className="text-neutral-700">&ldquo;{d.script.scriptSnippet}&rdquo;</span>
          </p>
          {d.script.voice && (
            <p className="mt-1 text-neutral-800">
              Voice: <span className="font-medium text-neutral-900">{d.script.voice.name}</span>{' '}
              <span className="text-neutral-500">— {d.script.voice.toneLabel}</span>
            </p>
          )}
          <div className="mt-3">
            <p className="text-xs font-medium text-neutral-600">Refinements</p>
            <div className="mt-1.5">
              <RefinementList items={d.script.refinements} />
            </div>
          </div>
        </div>
      )}

      {d.audio && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Audio</h3>
          <p className="mt-2 text-neutral-800">
            Approved on attempt <span className="font-mono">#{d.audio.attempt}</span>
            {d.audio.regenerateCount > 0 && (
              <span className="text-neutral-500">
                {' '}
                (after {d.audio.regenerateCount} regenerate
                {d.audio.regenerateCount === 1 ? '' : 's'})
              </span>
            )}
            .
          </p>
        </div>
      )}
    </section>
  );
}
