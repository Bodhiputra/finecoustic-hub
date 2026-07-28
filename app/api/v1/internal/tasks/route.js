import {
  createInternalTask,
  listInternalTasks,
} from '@/lib/api/internal-tasks-handlers';

export async function GET(request) {
  return listInternalTasks(request);
}

export async function POST(request) {
  return createInternalTask(request);
}
