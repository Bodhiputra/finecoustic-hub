import { personKey } from '@/lib/appdev';
import { PROTECTED_ASSIGNEE } from '@/lib/appdev-constants';

/** @see lib/appdev.js — PROTECTED_ASSIGNEE matches issue.assignee (task assigner), not worker. */
export { PROTECTED_ASSIGNEE } from '@/lib/appdev-constants';

export function isProtectedAssigner(displayName) {
  return personKey(displayName) === personKey(PROTECTED_ASSIGNEE);
}
