/** Client hook — refresh hub bell after server-side notification writes. */
export const HUB_NOTIFICATIONS_REFRESH_EVENT = 'hub-notifications:refresh';

export function signalHubNotificationsRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HUB_NOTIFICATIONS_REFRESH_EVENT));
}
