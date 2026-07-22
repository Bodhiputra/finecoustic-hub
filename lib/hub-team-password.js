import { getHubPassword } from '@/lib/auth';

/** Shared team password (OPS_HUB_PASSWORD) — sign-in and sign-up only. */
export function getTeamPassword() {
  return getHubPassword();
}

export function isTeamPasswordConfigured() {
  return Boolean(getTeamPassword());
}

export function isTeamPassword(attempt) {
  const team = getTeamPassword();
  if (!team) return false;
  return String(attempt || '').trim() === team;
}
