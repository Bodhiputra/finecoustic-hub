import { createInternalDepartmentBoard, listInternalBoards } from '@/lib/api/internal-campaigns-handlers';

export async function GET(request) {
  return listInternalBoards(request);
}

export async function POST(request) {
  return createInternalDepartmentBoard(request);
}
