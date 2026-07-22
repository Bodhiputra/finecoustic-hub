import {
  deleteWarzoneTask,
  getWarzoneTask,
  patchWarzoneTask,
} from '@/lib/api/warzone-tasks-handlers';

export async function GET(request, context) {
  return getWarzoneTask(request, context);
}

export async function PATCH(request, context) {
  return patchWarzoneTask(request, context);
}

export async function DELETE(request, context) {
  return deleteWarzoneTask(request, context);
}
