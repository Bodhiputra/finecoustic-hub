import { getInternalTasksRevisionHandler } from '@/lib/api/internal-tasks-revision-handlers';

export async function GET(request) {
  return getInternalTasksRevisionHandler(request);
}
