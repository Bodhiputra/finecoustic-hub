export const DRAFT_ISSUE_PREFIX = '__draft__';

export function isDraftIssue(issueOrId) {
  const id = typeof issueOrId === 'string' ? issueOrId : issueOrId?.id;
  return String(id || '').startsWith(DRAFT_ISSUE_PREFIX);
}

export function createDraftIssue({ title, assignee = '', previewNumber = null }) {
  const now = new Date().toISOString();
  const preview =
    previewNumber != null && Number.isFinite(Number(previewNumber)) && Number(previewNumber) > 0
      ? Number(previewNumber)
      : null;

  return {
    id: `${DRAFT_ISSUE_PREFIX}${Date.now()}`,
    preview_number: preview,
    title: String(title || '').trim() || 'New issue',
    description: '',
    type: 'task',
    status: 'todo',
    priority: 'none',
    assignee: String(assignee || '').trim(),
    workers: [],
    worker: '',
    assigned_at: null,
    completed_at: null,
    image_urls: [],
    video_urls: [],
    comments: [],
    created_at: now,
    updated_at: now,
  };
}
