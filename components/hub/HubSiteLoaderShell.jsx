import HubSiteLoader from '@/components/hub/HubSiteLoader';
import { hubSiteLoaderBootScript } from '@/lib/hub-site-loader';

/** Server shell — boot script + client loader orchestration for Fine Teams splash. */
export default function HubSiteLoaderShell({ children }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: hubSiteLoaderBootScript() }} />
      <HubSiteLoader />
      {children}
    </>
  );
}
