import {
  createInternalTask,
  listInternalTasks,
} from '@/lib/api/internal-tasks-handlers';
import { NextResponse } from 'next/server';

/** @deprecated Use GET/POST /api/v1/internal/tasks — legacy `{ tasks }` shape. */
export async function GET(request) {
  const res = await listInternalTasks(request);
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  return NextResponse.json({ tasks: body.data?.tasks ?? [] });
}

/** @deprecated Use POST /api/v1/internal/tasks */
export async function POST(request) {
  const res = await createInternalTask(request);
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  return NextResponse.json({ task: body.data?.task }, { status: 201 });
}
