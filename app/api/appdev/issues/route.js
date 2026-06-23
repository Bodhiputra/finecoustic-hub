import { NextResponse } from 'next/server';
import { createIssue, getAppdevData } from '@/lib/appdev-data';
import { resolveAppdevActor } from '@/lib/appdev-actor';

export async function GET() {
  const data = await getAppdevData();
  return NextResponse.json(data);
}

export async function POST(request) {
  const actor = await resolveAppdevActor();
  if (!actor.ok) {
    return NextResponse.json({ error: actor.reason || 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await createIssue(body, actor);
  if (result?.forbidden) {
    return NextResponse.json({ error: result.reason }, { status: 403 });
  }
  if (!result) {
    return NextResponse.json({ error: 'Assigner required' }, { status: 400 });
  }
  const { issue, people } = result;
  return NextResponse.json({ issue, people, next_number: result.next_number, task_types: result.task_types }, { status: 201 });
}
