export default function RouteLoading({ variant = 'hub', label = 'Loading…' }) {
  return (
    <div className={`route-loading route-loading--${variant}`} role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span className="route-loading-label">{label}</span>
    </div>
  );
}
