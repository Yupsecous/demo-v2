import { useAppStore } from '../store';
import { humanize } from '../services/errorMessages';

// Shared error surface used by every step. Takes either an error (from
// catch) or an already-humanized message string. Renders a Retry button
// and, when appropriate, an Open Settings button.

type Props = {
  error?: unknown;
  message?: string;
  pointToSettings?: boolean;
  onRetry?: () => void;
};

export function InlineError({ error, message, pointToSettings, onRetry }: Props) {
  const openDrawer = useAppStore((s) => s.openDrawer);
  let copy = message ?? '';
  let showSettings = pointToSettings ?? false;
  if (error !== undefined && copy === '') {
    const h = humanize(error);
    copy = h.message;
    showSettings = h.pointToSettings;
  }
  if (!copy) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">Something interrupted that step</p>
      <p className="mt-1 text-sm text-red-700">{copy}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        )}
        {showSettings && (
          <button
            type="button"
            onClick={openDrawer}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Open Settings
          </button>
        )}
      </div>
    </div>
  );
}
