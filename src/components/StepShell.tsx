import { useAppStore, activeStepId, allApproved } from '../store';
import { CopyStep } from './CopyStep';
import { ImageStep } from './ImageStep';
import { ScriptStep } from './ScriptStep';
import { AudioStep } from './AudioStep';
import { FinalPackage } from './FinalPackage';
import { STEP_LABELS, type StepId } from '../types';

function Placeholder({ stepId }: { stepId: StepId }) {
  return (
    <section className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-700">
        {STEP_LABELS[stepId]}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Coming next. This step is wired into the state machine but the UI lands on a later day.
      </p>
    </section>
  );
}

export function StepShell() {
  const state = useAppStore();

  if (allApproved(state)) {
    return <FinalPackage />;
  }

  const activeId = activeStepId(state);
  if (!activeId) {
    return (
      <section className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
        No active step.
      </section>
    );
  }

  if (activeId === 'copy') return <CopyStep />;
  if (activeId === 'image') return <ImageStep />;
  if (activeId === 'script') return <ScriptStep />;
  if (activeId === 'audio') return <AudioStep />;

  return <Placeholder stepId={activeId} />;
}
