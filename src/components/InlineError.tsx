import { useAppStore } from '../store';
import { humanize, isAppError } from '../services/errorMessages';

// Shared error surface used by every step. Renders the plain-language
// message via humanize(), a Try-again button, and an Open Settings
// button when the failure points there. A collapsible "Show technical
// detail" disclosure surfaces the AppError.detail field (the actual
// status code, response body snippet, etc.) — useful when the friendly
// message is too generic to diagnose from, especially for the "all
// attempts failed" aggregate errors.

type Props = {
  error?: unknown;
  message?: string;
  pointToSettings?: boolean;
  onRetry?: () => void;
};

function detailOf(err: unknown): string | null {
  if (isAppError(err) && err.detail) return err.detail;
  if (err instanceof Error && err.message) return err.message;
  return null;
}

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
  const detail = error !== undefined ? detailOf(error) : null;
  const code = isAppError(error) ? error.code : null;
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
      {detail && (
        <details className="mt-3 text-xs text-red-700">
          <summary className="cursor-pointer select-none font-medium">
            Show technical detail
          </summary>
          <div className="mt-2 rounded border border-red-200 bg-white p-2 font-mono leading-relaxed text-red-900">
            {code && <div className="text-[10px] uppercase tracking-wider text-red-500">{code}</div>}
            <div className="whitespace-pre-wrap break-words">{detail}</div>
          </div>
        </details>
      )}
    </div>
  );
}
