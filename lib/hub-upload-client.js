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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }
  return data.url;
}

export async function uploadAppdevMediaFile(file, kind) {
  return uploadHubMediaFile(file, kind, 'appdev');
}

export async function uploadInternalMediaFile(file, kind) {
  return uploadHubMediaFile(file, kind, 'internal');
}
