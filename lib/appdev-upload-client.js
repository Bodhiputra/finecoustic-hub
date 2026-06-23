export async function uploadAppdevMediaFile(file, kind) {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const res = await fetch('/api/appdev/upload', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }
  return data.url;
}
