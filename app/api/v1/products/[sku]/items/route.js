import {
  createProductItemHandler,
  listProductItemsHandler,
} from '@/lib/api/products-handlers';

export async function GET(request, context) {
  return listProductItemsHandler(request, context);
}

export async function POST(request, context) {
  return createProductItemHandler(request, context);
}
