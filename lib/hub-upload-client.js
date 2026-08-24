export async function uploadHubMediaFile(file, kind, scope = 'appdev') {
  const endpoints = {
    appdev: '/api/appdev/upload',
    internal: '/api/v1/internal/upload',
  };
  const endpoint = endpoints[scope];
  if (!endpoint) throw new Error(`Unknown upload scope: ${scope}`);

  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const res = await fetch(endpoint, { method: 'POST', body: form, credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));
  const payload = body?.data ?? body;
  if (!res.ok) {
    throw new Error(payload?.error || body?.error || 'Upload failed');
  }
  const url = String(payload?.url || '').trim();
  if (!url) {
    throw new Error(payload?.error || body?.error || 'Upload failed');
  }
  return url;
}

export async function uploadAppdevMediaFile(file, kind) {
  return uploadHubMediaFile(file, kind, 'appdev');
}

export async function uploadAppdevAttachmentFile(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', 'file');
  const res = await fetch('/api/appdev/upload', { method: 'POST', body: form, credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));
  const payload = body?.data ?? body;
  if (!res.ok) {
    throw new Error(payload?.error || body?.error || 'Upload failed');
  }
  return {
    url: payload.url,
    name: payload.name || file.name,
    size: typeof payload.size === 'number' ? payload.size : file.size,
  };
}

export async function uploadInternalMediaFile(file, kind) {
  return uploadHubMediaFile(file, kind, 'internal');
}

export async function uploadInternalAttachmentFile(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', 'file');
  const res = await fetch('/api/v1/internal/upload', { method: 'POST', body: form, credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));
  const payload = body?.data ?? body;
  if (!res.ok) {
    throw new Error(payload?.error || body?.error || 'Upload failed');
  }
  return {
    url: payload.url,
    name: payload.name || file.name,
    size: typeof payload.size === 'number' ? payload.size : file.size,
  };
}
