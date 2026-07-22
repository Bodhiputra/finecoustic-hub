import {
  createWarzoneTask,
  listWarzoneTasks,
} from '@/lib/api/warzone-tasks-handlers';

export async function GET(request) {
  return listWarzoneTasks(request);
}

export async function POST(request) {
  return createWarzoneTask(request);
}
