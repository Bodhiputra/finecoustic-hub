import '../styles/hub.css';
import '../styles/hub-prose.css';
import '../styles/panel.css';
import '../styles/hub-task-panel.css';
import '../styles/internal.css';
import '../styles/knowledge.css';
import '../styles/hub-site-loader.css';
import { HubSessionProvider } from '@/components/hub/HubSessionProvider';
import HubSiteLoaderShell from '@/components/hub/HubSiteLoaderShell';
import { loadHubSession } from '@/lib/page-loaders/hub-shell';

export default async function HubRealmLayout({ children }) {
  const session = await loadHubSession();

  return (
    <HubSessionProvider
      initialProfile={session.initialProfile}
      authEnabled={session.authEnabled}
    >
      <HubSiteLoaderShell>{children}</HubSiteLoaderShell>
    </HubSessionProvider>
  );
}
