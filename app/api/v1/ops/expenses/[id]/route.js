import { patchExpense } from '@/lib/api/expenses-handlers';

export async function PATCH(request, context) {
  return patchExpense(request, context);
}
