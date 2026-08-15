import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import {
  createExpense,
  expensesToCsv,
  listExpenses,
  updateExpense,
} from '@/lib/hub-expenses';
import {
  restError,
  restForbidden,
  restNotFound,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function requireOpsAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  if (!canAccessDepartment(actor, 'operations')) return restForbidden('department_forbidden');
  return null;
}

export async function getExpenses(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOpsAccess(actor);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  if (searchParams.get('format') === 'csv') {
    const expenses = await listExpenses();
    const csv = expensesToCsv(expenses);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hub-expenses.csv"',
      },
    });
  }

  const expenses = await listExpenses();
  return restOk({ expenses, count: expenses.length });
}

export async function postExpense(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOpsAccess(actor);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  try {
    const expense = await createExpense(body, actor.displayName);
    return restOk({ expense });
  } catch (e) {
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function patchExpense(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOpsAccess(actor);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  try {
    const { id } = await params;
    const expense = await updateExpense(id, body);
    return restOk({ expense });
  } catch (e) {
    if (e.status === 404) return restNotFound('not_found');
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}
