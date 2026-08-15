import { getExpenses, postExpense } from '@/lib/api/expenses-handlers';

export async function GET(request) {
  return getExpenses(request);
}

export async function POST(request) {
  return postExpense(request);
}
