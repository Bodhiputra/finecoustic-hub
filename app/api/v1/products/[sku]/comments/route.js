import { postProductThreadComment } from '@/lib/api/products-handlers';

export async function POST(request, context) {
  return postProductThreadComment(request, context);
}
