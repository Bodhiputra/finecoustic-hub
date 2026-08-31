'use client';

/** Spinner + label for primary/ghost buttons while an action is in flight. */
export default function ButtonBusyContent({ busy = false, busyLabel = '', children }) {
  if (!busy) return children;
  return (
    <>
      <span className="appdev-btn-spinner" aria-hidden="true" />
      {busyLabel}
    </>
  );
}
