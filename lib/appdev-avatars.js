/**
 * Initials + deterministic avatar colors (Google Docs–style).
 */

export function nameToInitials(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '?';

  const parts = trimmed.split(/[\s\-_]+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] || '';
    const b = parts[parts.length - 1][0] || '';
    if (a && b) return `${a}${b}`.toUpperCase();
  }

  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(trimmed)) {
    return trimmed.slice(-Math.min(2, trimmed.length));
  }

  if (trimmed.length >= 2) return trimmed.slice(0, 2).toUpperCase();
  return trimmed[0].toUpperCase();
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
