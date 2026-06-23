import { NextResponse } from 'next/server';
import { deleteIssue, updateIssue } from '@/lib/appdev-data';
import { resolveAppdevActor } from '@/lib/appdev-actor';

const ERROR_MESSAGES = {
  task_locked: 'Only the task assigner can change title, description, type, priority, and attachments.',
  status_assigner_only: 'Done can only be set by the task assigner.',
  status_not_allowed: 'That status is not allowed on this task.',
  worker_required: 'Add at least one assignee before moving to In Progress.',
  workers_not_allowed: 'You can only add yourself as assignee on this task.',
  assignee_required: 'Join as assignee on this task to discuss or change status.',
  not_owner: 'Only the task assigner can delete this task.',
};

function errorResponse(reason, status = 403) {
  return NextResponse.json(
    { error: reason, message: ERROR_MESSAGES[reason] || 'Forbidden' },
    { status }
  );
}

export async function PATCH(request, { params }) {
  try {
    const actor = await resolveAppdevActor();
    if (!actor.ok) {
      return NextResponse.json({ error: actor.reason || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await updateIssue(decodeURIComponent(id), body, { actor });
    if (result?.forbidden) {
      return errorResponse(result.reason);
    }
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('[appdev] PATCH issue failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const actor = await resolveAppdevActor();
    if (!actor.ok) {
      return NextResponse.json({ error: actor.reason || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await deleteIssue(decodeURIComponent(id), { actor });
    if (!result.ok && result.reason === 'not_owner') {
      return errorResponse('not_owner');
    }
    if (!result.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[appdev] DELETE issue failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
