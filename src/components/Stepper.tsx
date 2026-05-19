import { useAppStore, activeStepId, isStepUnlocked } from '../store';
import { STEP_ORDER, type StepId, type StepStatus } from '../types';

function statusGlyph(status: StepStatus): string {
  switch (status) {
    case 'approved':
      return '✓';
    case 'generating':
      return '…';
    case 'options':
    case 'refining':
      return '•';
    case 'pending':
    default:
      return '';
  }
}

export function Stepper() {
  const state = useAppStore();
  const active = activeStepId(state);

  return (
    <ol className="flex w-full items-center gap-2">
      {STEP_ORDER.map((id, idx) => {
        const step = state.steps[id];
        const unlocked = isStepUnlocked(state, id);
        const isActive = active === id;
        const isApproved = step.status === 'approved';
        const clickable = isApproved;

        const base = 'flex flex-1 items-center gap-3 rounded-md border px-4 py-3 transition-colors';
        const tone = !unlocked
          ? 'border-neutral-200 bg-neutral-50 text-neutral-400'
          : isActive
            ? 'border-neutral-900 bg-white text-neutral-900'
            : isApproved
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-neutral-300 bg-white text-neutral-700';
        const interactivity = clickable ? 'cursor-pointer hover:bg-emerald-100' : 'cursor-default';

        return (
          <li key={id} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && state.reopenStep(id as StepId)}
              className={`${base} ${tone} ${interactivity}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs font-medium">
                {statusGlyph(step.status) || idx + 1}
              </span>
              <span className="flex flex-col items-start">
                <span className="text-xs uppercase tracking-wide opacity-60">Step {idx + 1}</span>
                <span className="text-sm font-medium">{step.label}</span>
              </span>
            </button>
            {idx < STEP_ORDER.length - 1 && <span className="h-px w-4 bg-neutral-200" />}
          </li>
        );
      })}
    </ol>
  );
}
