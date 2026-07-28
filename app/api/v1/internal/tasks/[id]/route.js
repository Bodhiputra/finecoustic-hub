import {
  deleteInternalTask,
  getInternalTask,
  patchInternalTask,
} from '@/lib/api/internal-tasks-handlers';

export async function GET(request, context) {
  return getInternalTask(request, context);
}

export async function PATCH(request, context) {
  return patchInternalTask(request, context);
}

export async function DELETE(request, context) {
  return deleteInternalTask(request, context);
}
