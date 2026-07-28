import { getInternalBoard } from '@/lib/api/internal-campaigns-handlers';

export async function GET(request, context) {
  return getInternalBoard(request, context);
}
