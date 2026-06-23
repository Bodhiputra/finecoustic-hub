export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 15 * 1024 * 1024;

export const IMAGE_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png';
export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov';
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);

function extOf(name = '') {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function isImageFile(file) {
  if (!file) return false;
  const ext = extOf(file.name);
  return IMAGE_MIMES.has(file.type) || ['.jpg', '.jpeg', '.png'].includes(ext);
}

export function isVideoFile(file) {
  if (!file) return false;
  const ext = extOf(file.name);
  return VIDEO_MIMES.has(file.type) || ['.mp4', '.mov'].includes(ext);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMaxLabel(bytes) {
  return `${bytes / (1024 * 1024)} MB`;
}

function readAscii(bytes, start, len) {
  return String.fromCharCode(...bytes.slice(start, start + len));
}

/** Inspect file header bytes — not extension/MIME alone. */
export function sniffMediaMime(bytes) {
  if (!bytes || bytes.length < 4) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 8 && readAscii(bytes, 4, 4) === 'ftyp') {
    const brand = readAscii(bytes, 8, 4);
    if (brand.startsWith('qt')) return 'video/quicktime';
    return 'video/mp4';
  }

  return null;
}

export async function sniffMediaFile(file) {
  if (!file) return null;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniffMediaMime(head);
}

export function validateImageFile(file) {
  if (!file) return { ok: false, error: 'fileRequired' };
  if (!isImageFile(file)) return { ok: false, error: 'imageType', fileName: file.name };
  if (typeof file.size !== 'number' || file.size <= 0) {
    return { ok: false, error: 'fileRequired', fileName: file.name };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: 'imageSize',
      fileName: file.name,
      size: file.size,
      max: IMAGE_MAX_BYTES,
    };
  }
  return { ok: true, fileName: file.name, size: file.size };
}

export function validateVideoFile(file) {
  if (!file) return { ok: false, error: 'fileRequired' };
  if (!isVideoFile(file)) return { ok: false, error: 'videoType', fileName: file.name };
  if (typeof file.size !== 'number' || file.size <= 0) {
    return { ok: false, error: 'fileRequired', fileName: file.name };
  }
  if (file.size > VIDEO_MAX_BYTES) {
    return {
      ok: false,
      error: 'videoSize',
      fileName: file.name,
      size: file.size,
      max: VIDEO_MAX_BYTES,
    };
  }
  return { ok: true, fileName: file.name, size: file.size };
}

export async function validateImageFileDeep(file) {
  const base = validateImageFile(file);
  if (!base.ok) return base;

  const sniffed = await sniffMediaFile(file);
  if (sniffed !== 'image/jpeg' && sniffed !== 'image/png') {
    return { ok: false, error: 'imageType', fileName: file.name };
  }
  return base;
}

export async function validateVideoFileDeep(file) {
  const base = validateVideoFile(file);
  if (!base.ok) return base;

  const sniffed = await sniffMediaFile(file);
  if (sniffed !== 'video/mp4' && sniffed !== 'video/quicktime') {
    return { ok: false, error: 'videoType', fileName: file.name };
  }
  return base;
}

export function validateImageBuffer(buffer, declaredSize) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const size = bytes.byteLength;

  if (size <= 0) return { ok: false, error: 'fileRequired' };
  if (size > IMAGE_MAX_BYTES) {
    return { ok: false, error: 'imageSize', size, max: IMAGE_MAX_BYTES };
  }
  if (typeof declaredSize === 'number' && declaredSize > 0 && size !== declaredSize) {
    return { ok: false, error: 'sizeMismatch', size, declaredSize };
  }

  const sniffed = sniffMediaMime(bytes);
  if (sniffed !== 'image/jpeg' && sniffed !== 'image/png') {
    return { ok: false, error: 'imageType' };
  }

  return { ok: true, size, mime: sniffed };
}

export function validateVideoBuffer(buffer, declaredSize) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const size = bytes.byteLength;

  if (size <= 0) return { ok: false, error: 'fileRequired' };
  if (size > VIDEO_MAX_BYTES) {
    return { ok: false, error: 'videoSize', size, max: VIDEO_MAX_BYTES };
  }
  if (typeof declaredSize === 'number' && declaredSize > 0 && size !== declaredSize) {
    return { ok: false, error: 'sizeMismatch', size, declaredSize };
  }

  const sniffed = sniffMediaMime(bytes);
  if (sniffed !== 'video/mp4' && sniffed !== 'video/quicktime') {
    return { ok: false, error: 'videoType' };
  }

  return { ok: true, size, mime: sniffed };
}

function isUploadedMediaUrl(url) {
  return (
    url.startsWith('/api/appdev/media/') ||
    /\.(jpe?g|png|mp4|mov)(\?|$)/i.test(url) ||
    /blob\.vercel-storage\.com/i.test(url) ||
    /res\.cloudinary\.com/i.test(url)
  );
}

export function normalizeImageUrls(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const urls = [];
  for (const item of raw) {
    const url = String(item || '').trim();
    if (!url || seen.has(url)) continue;
    if (/^https?:\/\//i.test(url) || isUploadedMediaUrl(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

export function normalizeVideoUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || isUploadedMediaUrl(url)) return url;
  return '';
}

/** Accepts `video_urls` array and legacy single `video_url`. */
export function normalizeVideoUrls(raw, legacySingle = '') {
  const seen = new Set();
  const urls = [];
  const add = value => {
    const url = normalizeVideoUrl(value);
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };
  if (Array.isArray(raw)) {
    for (const item of raw) add(item);
  }
  add(legacySingle);
  return urls;
}

export function isDirectVideoUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (raw.startsWith('/api/appdev/media/')) return true;
  if (/\.(mp4|mov)(\?|$)/i.test(raw)) return true;
  if (/blob\.vercel-storage\.com/i.test(raw)) return true;
  if (/res\.cloudinary\.com/i.test(raw)) return true;
  return false;
}

export function getVideoEmbed(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  if (isDirectVideoUrl(raw)) {
    return { kind: 'video', src: raw };
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'loom.com') {
      const share = parsed.pathname.match(/^\/share\/([a-zA-Z0-9]+)/);
      if (share) {
        return { kind: 'iframe', src: `https://www.loom.com/embed/${share[1]}` };
      }
      const embed = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9]+)/);
      if (embed) {
        return { kind: 'iframe', src: `https://www.loom.com/embed/${embed[1]}` };
      }
    }

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}` };
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const fromQuery = parsed.searchParams.get('v');
      if (fromQuery) return { kind: 'iframe', src: `https://www.youtube.com/embed/${fromQuery}` };
      const fromPath = parsed.pathname.match(/^\/embed\/([^/?]+)/);
      if (fromPath) return { kind: 'iframe', src: `https://www.youtube.com/embed/${fromPath[1]}` };
    }

    if (host === 'drive.google.com') {
      const file = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
      if (file) {
        return { kind: 'iframe', src: `https://drive.google.com/file/d/${file[1]}/preview` };
      }
    }
  } catch {
    return { kind: 'link', href: raw };
  }

  return { kind: 'link', href: raw };
}

function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function tMedia(t, key, vars = {}) {
  return interpolate(t(key), vars);
}

export function translateMediaValidation(check, t) {
  if (!check || check.ok) return '';

  const vars = {
    name: check.fileName || 'File',
    size: typeof check.size === 'number' ? formatBytes(check.size) : '',
    max: typeof check.max === 'number' ? formatMaxLabel(check.max) : '',
  };

  switch (check.error) {
    case 'imageType':
      return interpolate(t('appdev.media.imageTypeErrorNamed'), vars);
    case 'videoType':
      return interpolate(t('appdev.media.videoTypeErrorNamed'), vars);
    case 'imageSize':
      return interpolate(t('appdev.media.imageSizeErrorNamed'), vars);
    case 'videoSize':
      return interpolate(t('appdev.media.videoSizeErrorNamed'), vars);
    case 'unsupportedType':
      return interpolate(t('appdev.media.unsupportedTypeNamed'), vars);
    case 'sizeMismatch':
      return t('appdev.media.sizeMismatch');
    default:
      return t('appdev.media.uploadFailed');
  }
}
