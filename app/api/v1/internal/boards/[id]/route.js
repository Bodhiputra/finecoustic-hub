import { getInternalBoard, patchInternalBoard } from '@/lib/api/internal-campaigns-handlers';

export async function GET(request, context) {
  return getInternalBoard(request, context);
}

export async function PATCH(request, context) {
  return patchInternalBoard(request, context);
}
