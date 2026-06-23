const encoder = new TextEncoder();

/** Edge-safe APPDEV_PASSWORD fingerprint — changing env value invalidates dev sessions. */
export async function getAppdevPasswordVersion() {
  const pw = (process.env.APPDEV_PASSWORD || '').trim();
  if (!pw) return '0';
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(pw));
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 16);
}
