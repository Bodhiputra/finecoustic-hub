import {
  deleteWarzoneTask,
  getWarzoneTask,
  patchWarzoneTask,
} from '@/lib/api/warzone-tasks-handlers';
import { NextResponse } from 'next/server';

async function legacyJson(res, mapper) {
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  return NextResponse.json(mapper(body.data), { status: res.status });
}

/** @deprecated Use /api/v1/warzone/tasks/:id */
export async function GET(request, context) {
  const res = await getWarzoneTask(request, context);
  return legacyJson(res, data => ({ task: data?.task }));
}

export async function PATCH(request, context) {
  const res = await patchWarzoneTask(request, context);
  return legacyJson(res, data => ({ task: data?.task }));
}

export async function DELETE(request, context) {
  const res = await deleteWarzoneTask(request, context);
  if (res.status === 204) return NextResponse.json({ ok: true });
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
