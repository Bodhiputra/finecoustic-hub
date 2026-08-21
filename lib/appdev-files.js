import { formatBytes, formatMaxLabel } from '@/lib/appdev-media';

/** Enough for font zips, asset packs, and typical web deliverables. */
export const FILE_MAX_BYTES = 25 * 1024 * 1024;

export const FILE_MAX_COUNT = 20;

const ALLOWED_EXTENSIONS = new Set([
  '.zip',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
  '.pdf',
  '.svg',
  '.css',
  '.scss',
  '.json',
  '.txt',
  '.md',
  '.ico',
  '.webp',
]);

export const FILE_ACCEPT = Array.from(ALLOWED_EXTENSIONS).join(',');

const EXT_MIME = {
  '.zip': 'application/zip',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.scss': 'text/x-scss',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function extOf(name = '') {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function isAllowedAttachmentFile(file) {
  if (!file) return false;
  return ALLOWED_EXTENSIONS.has(extOf(file.name));
}

export function mimeForAttachmentName(name = '') {
  return EXT_MIME[extOf(name)] || 'application/octet-stream';
}

function readAscii(bytes, start, len) {
  return String.fromCharCode(...bytes.slice(start, start + len));
}

export function sniffAttachmentMime(bytes, fileName = '') {
  if (!bytes || bytes.length < 4) return null;
  const ext = extOf(fileName);

  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'application/zip';
  if (readAscii(bytes, 0, 4) === '%PDF') return 'application/pdf';
  if (ext === '.svg' && readAscii(bytes, 0, 5).toLowerCase().includes('<svg')) return 'image/svg+xml';
  if (ext === '.json') {
    const head = readAscii(bytes, 0, Math.min(bytes.length, 8)).trim();
    if (head.startsWith('{') || head.startsWith('[')) return 'application/json';
  }

  return mimeForAttachmentName(fileName);
}

export function validateAttachmentFile(file) {
  if (!file) return { ok: false, error: 'fileRequired' };
  if (!isAllowedAttachmentFile(file)) {
    return { ok: false, error: 'fileType', fileName: file.name };
  }
  if (typeof file.size !== 'number' || file.size <= 0) {
    return { ok: false, error: 'fileRequired', fileName: file.name };
  }
  if (file.size > FILE_MAX_BYTES) {
    return {
      ok: false,
      error: 'fileSize',
      fileName: file.name,
      size: file.size,
      max: FILE_MAX_BYTES,
    };
  }
  return { ok: true, fileName: file.name, size: file.size };
}

export async function validateAttachmentFileDeep(file) {
  const base = validateAttachmentFile(file);
  if (!base.ok) return base;

  const ext = extOf(file.name);
  if (ext === '.zip' || ext === '.pdf') {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const sniffed = sniffAttachmentMime(head, file.name);
    if (ext === '.zip' && sniffed !== 'application/zip') {
      return { ok: false, error: 'fileType', fileName: file.name };
    }
    if (ext === '.pdf' && sniffed !== 'application/pdf') {
      return { ok: false, error: 'fileType', fileName: file.name };
    }
  }

  return base;
}

export function validateAttachmentBuffer(buffer, declaredSize, fileName = '') {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const size = bytes.byteLength;

  if (size <= 0) return { ok: false, error: 'fileRequired' };
  if (size > FILE_MAX_BYTES) {
    return { ok: false, error: 'fileSize', size, max: FILE_MAX_BYTES };
  }
  if (typeof declaredSize === 'number' && declaredSize > 0 && size !== declaredSize) {
    return { ok: false, error: 'sizeMismatch', size, declaredSize };
  }
  if (!ALLOWED_EXTENSIONS.has(extOf(fileName))) {
    return { ok: false, error: 'fileType' };
  }

  const ext = extOf(fileName);
  const sniffed = sniffAttachmentMime(bytes.slice(0, Math.min(bytes.length, 16)), fileName);
  if (ext === '.zip' && sniffed !== 'application/zip') {
    return { ok: false, error: 'fileType' };
  }
  if (ext === '.pdf' && sniffed !== 'application/pdf') {
    return { ok: false, error: 'fileType' };
  }

  return { ok: true, size, mime: sniffed || mimeForAttachmentName(fileName) };
}

function isUploadedFileUrl(url) {
  return (
    url.startsWith('/api/appdev/media/') ||
    /blob\.vercel-storage\.com/i.test(url) ||
    /res\.cloudinary\.com/i.test(url)
  );
}

export function normalizeFileEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.url || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url) && !isUploadedFileUrl(url)) return null;

  const name = String(raw.name || '').trim() || url.split('/').pop()?.split('?')[0] || 'file';
  const size = typeof raw.size === 'number' && raw.size > 0 ? raw.size : 0;
  return { url, name, size };
}

export function normalizeFileUrls(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const files = [];
  for (const item of raw) {
    const entry = normalizeFileEntry(item);
    if (!entry || seen.has(entry.url)) continue;
    seen.add(entry.url);
    files.push(entry);
  }
  return files.slice(0, FILE_MAX_COUNT);
}

function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function translateFileValidation(check, t) {
  if (!check || check.ok) return '';

  const vars = {
    name: check.fileName || 'File',
    size: typeof check.size === 'number' ? formatBytes(check.size) : '',
    max: typeof check.max === 'number' ? formatMaxLabel(check.max) : '',
  };

  switch (check.error) {
    case 'fileType':
      return interpolate(t('appdev.files.typeErrorNamed'), vars);
    case 'fileSize':
      return interpolate(t('appdev.files.sizeErrorNamed'), vars);
    case 'fileLimit':
      return interpolate(t('appdev.files.limitError'), { max: FILE_MAX_COUNT });
    case 'sizeMismatch':
      return t('appdev.media.sizeMismatch');
    default:
      return t('appdev.files.uploadFailed');
  }
}

export function fileIconLabel(name = '') {
  const ext = extOf(name);
  if (ext === '.zip') return 'ZIP';
  if (['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)) return 'FONT';
  if (ext === '.pdf') return 'PDF';
  return ext.replace('.', '').toUpperCase() || 'FILE';
}
