import {
  createWarzoneTask,
  listWarzoneTasks,
} from '@/lib/api/warzone-tasks-handlers';
import { NextResponse } from 'next/server';

/** @deprecated Use GET/POST /api/v1/warzone/tasks — legacy `{ tasks }` shape. */
export async function GET(request) {
  const res = await listWarzoneTasks(request);
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  return NextResponse.json({ tasks: body.data?.tasks ?? [] });
}

/** @deprecated Use POST /api/v1/warzone/tasks */
export async function POST(request) {
  const res = await createWarzoneTask(request);
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  return NextResponse.json({ task: body.data?.task }, { status: 201 });
}
