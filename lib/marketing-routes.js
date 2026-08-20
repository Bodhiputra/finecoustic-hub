/** Path-based Marketing workspace routes (prefer over ?tool= query params). */

export const MARKETING_TOOL_IDS = ['kol-pool', 'kol-outreach', 'preorder-survey'];

export function marketingToolPath(toolId) {
  const id = String(toolId || '').trim();
  if (!MARKETING_TOOL_IDS.includes(id)) return '/marketing';
  return `/marketing/${id}`;
}

export function marketingToolFromPathname(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '');
  for (const id of MARKETING_TOOL_IDS) {
    if (path === `/marketing/${id}`) return id;
  }
  return '';
}

/** Redirect legacy ?tool= URLs to dedicated paths. */
export function marketingToolQueryRedirect(tool) {
  const id = String(tool || '').trim();
  if (!MARKETING_TOOL_IDS.includes(id)) return null;
  return marketingToolPath(id);
}
