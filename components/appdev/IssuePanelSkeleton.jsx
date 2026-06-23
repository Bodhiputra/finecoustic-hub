export default function IssuePanelSkeleton() {
  return (
    <>
      <div className="appdev-overlay appdev-overlay-static" aria-hidden="true" />
      <aside className="appdev-panel appdev-panel-loading" aria-busy="true" aria-label="Loading task">
        <span className="route-loading-spinner" aria-hidden="true" />
      </aside>
    </>
  );
}
