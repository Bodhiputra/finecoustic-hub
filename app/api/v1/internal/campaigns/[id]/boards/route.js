import { createInternalBoard } from '@/lib/api/internal-campaigns-handlers';

export async function POST(request, context) {
  return createInternalBoard(request, context);
}
