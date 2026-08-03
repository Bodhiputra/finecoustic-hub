import { postProductItemComment } from '@/lib/api/products-handlers';

export async function POST(request, context) {
  return postProductItemComment(request, context);
}
