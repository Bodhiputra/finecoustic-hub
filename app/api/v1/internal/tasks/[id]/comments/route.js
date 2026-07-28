import { postInternalTaskComment } from '@/lib/api/internal-tasks-handlers';

export async function POST(request, context) {
  return postInternalTaskComment(request, context);
}
