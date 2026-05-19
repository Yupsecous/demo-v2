export function CacheRestorePill() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3M12 4v3h-3M4 12V9h3"
        />
      </svg>
      <span>Restored from your earlier choices · no regeneration</span>
    </div>
  );
}
