import { HubLoaderSplash } from '@/components/hub/HubSiteLoader';
import { hubLoaderTaglineForDepartment } from '@/lib/hub-site-loader';

export default function DepartmentRouteLoading({ departmentId = 'all' }) {
  const tagline = departmentId === 'all'
    ? 'fine team.'
    : hubLoaderTaglineForDepartment(departmentId);

  return <HubLoaderSplash tagline={tagline} />;
}
