import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

const DATA_ROOT = join(process.cwd(), 'data');

const SCOPES = {
  appdev: {
    cloudinaryFolder: 'finehub/appdev',
    blobPrefix: 'appdev',
    localDir: join(DATA_ROOT, 'appdev-uploads'),
    localUrl: name => `/api/appdev/media/${name}`,
  },
  internal: {
    cloudinaryFolder: 'finehub/internal',
    blobPrefix: 'internal',
    localDir: join(DATA_ROOT, 'internal-uploads'),
    localUrl: name => `/api/v1/internal/media/${encodeURIComponent(name)}`,
  },
};

function extForMime(mime, fallbackName = '') {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'video/mp4') return '.mp4';
  if (mime === 'video/quicktime') return '.mov';
  const dot = fallbackName.lastIndexOf('.');
  if (dot >= 0) return fallbackName.slice(dot).toLowerCase();
  return '';
}

function resourceTypeForMime(mime) {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return 'raw';
}

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

function ensureCloudinaryConfig() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    secure: true,
  });
}

function getScopeConfig(scope) {
  const config = SCOPES[scope];
  if (!config) throw new Error(`Unknown upload scope: ${scope}`);
  return config;
}

async function saveCloudinary(buffer, mime, scope, originalName = '') {
  ensureCloudinaryConfig();
  const { cloudinaryFolder } = getScopeConfig(scope);
  const resourceType = resourceTypeForMime(mime);
  const publicId = randomUUID();

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cloudinaryFolder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
      },
      (err, uploadResult) => {
        if (err) reject(err);
        else resolve(uploadResult);
      }
    );
    stream.end(buffer);
  });

  return result.secure_url;
}

async function saveLocal(buffer, mime, originalName, scope) {
  const { localDir, localUrl } = getScopeConfig(scope);
  await mkdir(localDir, { recursive: true });
  const ext = extForMime(mime, originalName);
  const name = `${randomUUID()}${ext}`;
  await writeFile(join(localDir, name), buffer);
  return localUrl(name);
}

async function saveBlob(buffer, mime, originalName, scope) {
  const { blobPrefix } = getScopeConfig(scope);
  const { put } = await import('@vercel/blob');
  const ext = extForMime(mime, originalName);
  const pathname = `${blobPrefix}/${randomUUID()}${ext}`;
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType: mime,
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function storeHubMedia(buffer, mime, originalName, scope = 'appdev') {
  if (isCloudinaryConfigured()) {
    return saveCloudinary(buffer, mime, scope, originalName);
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return saveBlob(buffer, mime, originalName, scope);
  }
  if (process.env.VERCEL) {
    throw new Error('Set CLOUDINARY_* or BLOB_READ_WRITE_TOKEN on Vercel for file uploads');
  }
  return saveLocal(buffer, mime, originalName, scope);
}

export async function readLocalHubMedia(name, scope = 'appdev') {
  const { localDir } = getScopeConfig(scope);
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe || safe !== name) return null;
  const filePath = join(localDir, safe);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    const data = await readFile(filePath);
    return { data, name: safe };
  } catch {
    return null;
  }
}

export function contentTypeForName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.otf')) return 'font/otf';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.eot')) return 'application/vnd.ms-fontobject';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.scss')) return 'text/x-scss';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}
