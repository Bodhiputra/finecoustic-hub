import { NextResponse } from 'next/server';

/** REST JSON helpers — all v1 routes use `{ data }` / `{ error }`. */

export function restOk(data, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function restCreated(data) {
  return restOk(data, 201);
}

export function restNoContent() {
  return new NextResponse(null, { status: 204 });
}

export function restError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function restUnauthorized() {
  return restError('unauthorized', 401);
}

export function restForbidden(code = 'forbidden') {
  return restError(code, 403);
}

export function restNotFound(resource = 'not_found') {
  return restError(resource, 404);
}
