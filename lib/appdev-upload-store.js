import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

const UPLOAD_DIR = join(process.cwd(), 'data/appdev-uploads');
const CLOUDINARY_FOLDER = 'finehub/appdev';

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

async function saveCloudinary(buffer, mime, originalName) {
  ensureCloudinaryConfig();
  const resourceType = mime.startsWith('video/') ? 'video' : 'image';
  const publicId = `${CLOUDINARY_FOLDER}/${randomUUID()}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: publicId.split('/').pop(),
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

async function saveLocal(buffer, mime, originalName) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extForMime(mime, originalName);
  const name = `${randomUUID()}${ext}`;
  await writeFile(join(UPLOAD_DIR, name), buffer);
  return `/api/appdev/media/${name}`;
}

async function saveBlob(buffer, mime, originalName) {
  const { put } = await import('@vercel/blob');
  const ext = extForMime(mime, originalName);
  const pathname = `appdev/${randomUUID()}${ext}`;
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType: mime,
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function storeAppdevMedia(buffer, mime, originalName) {
  if (isCloudinaryConfigured()) {
    return saveCloudinary(buffer, mime, originalName);
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return saveBlob(buffer, mime, originalName);
  }
  if (process.env.VERCEL) {
    throw new Error('Set CLOUDINARY_* or BLOB_READ_WRITE_TOKEN on Vercel for file uploads');
  }
  return saveLocal(buffer, mime, originalName);
}

export async function readLocalMedia(name) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe || safe !== name) return null;
  const filePath = join(UPLOAD_DIR, safe);
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
