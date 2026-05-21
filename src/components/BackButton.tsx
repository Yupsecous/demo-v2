type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

// Small, consistent "Back" affordance for the header of every step.
// Visually subtle (link-style) so it doesn't compete with the step's
// primary action, but always present so a misclick is one click away
// from undo.
export function BackButton({ label, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </button>
  );
}
