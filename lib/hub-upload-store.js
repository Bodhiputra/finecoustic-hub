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

async function saveCloudinary(buffer, mime, scope) {
  ensureCloudinaryConfig();
  const { cloudinaryFolder } = getScopeConfig(scope);
  const resourceType = mime.startsWith('video/') ? 'video' : 'image';
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
    return saveCloudinary(buffer, mime, scope);
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
  return 'application/octet-stream';
}
