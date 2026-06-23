import { NextResponse } from 'next/server';
import { addIssueComment } from '@/lib/appdev-data';
import { resolveAppdevActor } from '@/lib/appdev-actor';

export async function POST(request, { params }) {
  const actor = await resolveAppdevActor();
  if (!actor.ok) {
    return NextResponse.json({ error: actor.reason || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await addIssueComment(decodeURIComponent(id), body, actor);
  if (result?.forbidden) {
    return NextResponse.json(
      {
        error: result.reason,
        message: 'Join as assignee on this task to discuss or change status.',
      },
      { status: 403 }
    );
  }
  if (!result) {
    return NextResponse.json({ error: 'Invalid comment or not found' }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
