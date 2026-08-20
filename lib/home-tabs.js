import { isCampaignHomeTab } from '@/lib/campaign-urls';
import { isFinecousticWikiHomeView } from '@/lib/knowledge';

export const HOME_TAB = {
  SCHEDULE: 'schedule',
  CAMPAIGNS: 'campaigns',
  WIKI: 'wiki',
};

/** Resolve hub home tab from URL search params (server or client). */
export function homeTabFromSearchParams(searchParams) {
  if (isFinecousticWikiHomeView(searchParams)) return HOME_TAB.WIKI;
  if (isCampaignHomeTab(searchParams)) return HOME_TAB.CAMPAIGNS;
  return HOME_TAB.SCHEDULE;
}

/** Parse hub home tab + wiki page from URL search params. */
export function homeTabStateFromSearchParams(searchParams) {
  const get = key => (typeof searchParams?.get === 'function' ? searchParams.get(key) : searchParams?.[key]) || '';
  return {
    tab: homeTabFromSearchParams(searchParams),
    wikiPageId: get('page'),
  };
}

/** Build hub home URL for a tab — used with history.replaceState (no RSC refetch). */
export function homeTabToUrl(tab, { pageId = '', flowId = '' } = {}) {
  if (tab === HOME_TAB.CAMPAIGNS) {
    const params = new URLSearchParams({ campaigns: '1' });
    if (flowId) params.set('flow', flowId);
    return `/?${params.toString()}`;
  }
  if (tab === HOME_TAB.WIKI) {
    const params = new URLSearchParams({ wiki: '1' });
    if (pageId) params.set('page', pageId);
    return `/?${params.toString()}`;
  }
  return '/';
}
