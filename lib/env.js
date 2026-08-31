/** Strip surrounding quotes from env values (common when pasted into Vercel/.env.local). */
export function stripEnvValue(raw = '') {
  let value = String(raw || '').trim();
  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

export function envValue(name) {
  return stripEnvValue(process.env[name]);
}
