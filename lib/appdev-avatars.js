/**
 * Initials + deterministic avatar colors (Google Docs–style).
 */

export function nameToInitials(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '?';

  const parts = trimmed.split(/[\s\-_·]+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0].match(/[A-Za-z0-9]/)?.[0] || parts[0][0] || '';
    const lastPart = parts[parts.length - 1];
    const last = lastPart.match(/[\u4e00-\u9fff]/)?.[0]
      || lastPart.match(/[A-Za-z0-9]/)?.[0]
      || lastPart[0]
      || '';
    if (first && last) {
      return `${first}${last}`.toUpperCase();
    }
  }

  const cjk = trimmed.match(/[\u4e00-\u9fff]/g);
  if (cjk?.length) {
    return cjk.slice(-Math.min(2, cjk.length)).join('');
  }

  const alnum = trimmed.match(/[A-Za-z0-9]/g);
  if (alnum?.length >= 2) return alnum.slice(0, 2).join('').toUpperCase();
  if (alnum?.length === 1) return alnum[0].toUpperCase();
  return trimmed.slice(0, 2);
}

export function nameToAvatarColor(name) {
  let hash = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i += 1) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 52% 42%)`;
}

export function avatarStyle(name) {
  return {
    backgroundColor: nameToAvatarColor(name),
    color: '#fff',
  };
}
