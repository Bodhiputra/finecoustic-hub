import { NextResponse } from 'next/server';
import {
  isImageFile,
  isVideoFile,
  validateImageBuffer,
  validateImageFile,
  validateVideoBuffer,
  validateVideoFile,
  formatBytes,
  formatMaxLabel,
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
} from '@/lib/appdev-media';
import { storeAppdevMedia } from '@/lib/appdev-upload-store';
import { resolveAppdevActor } from '@/lib/appdev-actor';

export const runtime = 'nodejs';
export const maxDuration = 120;

function uploadError(check, kind) {
  if (check.error === 'imageSize' || check.error === 'videoSize') {
    const max = kind === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    return `${kind === 'image' ? 'Image' : 'Video'} is ${formatBytes(check.size)} — max ${formatMaxLabel(max)}`;
  }
  if (check.error === 'imageType') return 'Only JPEG, JPG, and PNG images are allowed';
  if (check.error === 'videoType') return 'Only MP4 and MOV videos are allowed';
  if (check.error === 'sizeMismatch') return 'File size mismatch — upload rejected';
  return 'Invalid file';
}

export async function POST(request) {
  const actor = await resolveAppdevActor();
  if (!actor.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const kind = String(form.get('kind') || '').trim();
  const file = form.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'File required' }, { status: 400 });
  }

  if (kind === 'image') {
    if (!isImageFile(file)) {
      return NextResponse.json({ error: 'Only JPEG, JPG, and PNG images are allowed' }, { status: 400 });
    }
    const precheck = validateImageFile(file);
    if (!precheck.ok) {
      return NextResponse.json({ error: uploadError(precheck, 'image') }, { status: 400 });
    }
  } else if (kind === 'video') {
    if (!isVideoFile(file)) {
      return NextResponse.json({ error: 'Only MP4 and MOV videos are allowed' }, { status: 400 });
    }
    const precheck = validateVideoFile(file);
    if (!precheck.ok) {
      return NextResponse.json({ error: uploadError(precheck, 'video') }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const postcheck = kind === 'image'
    ? validateImageBuffer(buffer, file.size)
    : validateVideoBuffer(buffer, file.size);

  if (!postcheck.ok) {
    return NextResponse.json({ error: uploadError(postcheck, kind) }, { status: 400 });
  }

  const url = await storeAppdevMedia(buffer, postcheck.mime, file.name);

  return NextResponse.json({
    url,
    name: file.name,
    size: postcheck.size,
    kind,
  });
}
