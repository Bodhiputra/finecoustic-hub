/** Branded hub splash — mirrors finecoustic.com fc-site-loader behavior. */

export const HUB_LOADER_TAGLINE_HOME = 'fine team.';
export const HUB_LOADER_SEEN_KEY = 'hub-site-loader-seen';
export const HUB_LOADER_MIN_VISIBLE_MS = 1500;
export const HUB_LOADER_EXIT_MS = 900;
export const HUB_LOADER_FONT_WAIT_MS = 1000;
/** Never leave the splash up longer than this during dept navigation. */
export const HUB_LOADER_MAX_NAV_MS = 12000;

export const HUB_LOADER_NAV_READY_EVENT = 'hub-site-loader:ready';

export const HUB_DEPARTMENT_LOADER_TAGLINES = {
  operations: 'operations dept.',
  marketing: 'marketing dept.',
  products: 'products dept.',
  creatives: 'creatives dept.',
  personal: 'personal space.',
  campaigns: 'campaigns.',
  all: 'tasks dept.',
};

/** Resolve hub realm id from pathname — used to decide when to show dept splash. */
export function hubDepartmentIdFromPathname(pathname = '') {
  const path = String(pathname).replace(/\/+$/, '') || '/';
  if (path === '/me' || path.startsWith('/me/')) return 'personal';
  if (path === '/campaigns' || path.startsWith('/campaigns/')) return 'campaigns';
  if (path === '/tasks' || path.startsWith('/tasks/')) return 'all';
  if (path === '/ops' || path.startsWith('/ops/')) return 'operations';
  if (path.startsWith('/marketing')) return 'marketing';
  if (path === '/products' || path.startsWith('/products/')) return 'products';
  if (path === '/creatives' || path.startsWith('/creatives/')) return 'creatives';
  return null;
}

export function hubLoaderTaglineForDepartment(departmentId = '') {
  const id = String(departmentId || '').trim();
  if (!id) return HUB_LOADER_TAGLINE_HOME;
  return HUB_DEPARTMENT_LOADER_TAGLINES[id] || `${id} dept.`;
}

export function hubLoaderTaglineForPathname(pathname = '') {
  const dept = hubDepartmentIdFromPathname(pathname);
  if (dept) return hubLoaderTaglineForDepartment(dept);
  return HUB_LOADER_TAGLINE_HOME;
}

/** Fired before client nav — HubSiteLoader shows splash immediately on click. */
export const HUB_LOADER_NAV_EVENT = 'hub-site-loader:navigate';

export function shouldPlayHubLoaderForNavigation(fromPathname = '', toHref = '') {
  const toPath = String(toHref || '').split('?')[0] || '/';
  const fromDept = hubDepartmentIdFromPathname(fromPathname);
  const toDept = hubDepartmentIdFromPathname(toPath);
  return Boolean(toDept && toDept !== fromDept);
}

export function requestHubLoaderForNavigation(fromPathname = '', toHref = '') {
  if (typeof window === 'undefined') return false;
  const toPath = String(toHref || '').split('?')[0] || '/';
  if (!shouldPlayHubLoaderForNavigation(fromPathname, toPath)) return false;
  const toDept = hubDepartmentIdFromPathname(toPath);
  window.dispatchEvent(new CustomEvent(HUB_LOADER_NAV_EVENT, {
    detail: {
      tagline: hubLoaderTaglineForDepartment(toDept),
      deptId: toDept,
    },
  }));
  return true;
}

/** Fired when a department workspace shell has mounted (InternalDepartment). */
export function signalHubNavigationReady() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HUB_LOADER_NAV_READY_EVENT));
}

/** Inline boot script — sets pending class + tagline before React hydrates. */
export function hubSiteLoaderBootScript() {
  return `(function(){try{
    var nav=performance.getEntriesByType('navigation')[0];
    if(nav&&nav.type==='reload')return;
    if(sessionStorage.getItem('${HUB_LOADER_SEEN_KEY}')==='1')return;
    var path=(location.pathname||'/').replace(/\\/+$/, '')||'/';
    var tagline='${HUB_LOADER_TAGLINE_HOME}';
    if(path==='/me'||path.indexOf('/me/')===0)tagline='${HUB_DEPARTMENT_LOADER_TAGLINES.personal}';
    else if(path==='/campaigns'||path.indexOf('/campaigns/')===0)tagline='${HUB_DEPARTMENT_LOADER_TAGLINES.campaigns}';
    else if(path==='/tasks'||path.indexOf('/tasks/')===0)tagline='${HUB_DEPARTMENT_LOADER_TAGLINES.all}';
    else if(path==='/ops'||path.indexOf('/ops/')===0)tagline='${HUB_DEPARTMENT_LOADER_TAGLINES.operations}';
    else if(path.indexOf('/marketing')===0)tagline='${HUB_DEPARTMENT_LOADER_TAGLINES.marketing}';
    else if(path==='/products'||path.indexOf('/products/')===0)tagline='${HUB_DEPARTMENT_LOADER_TAGLINES.products}';
    else if(path==='/creatives'||path.indexOf('/creatives/')===0)tagline='${HUB_DEPARTMENT_LOADER_TAGLINES.creatives}';
    document.documentElement.classList.add('hub-site-loader-pending');
    var el=document.getElementById('hub-site-loader-tagline');
    if(el)el.textContent=tagline;
  }catch(e){}})();`;
}
