import { getProduct, patchProduct } from '@/lib/api/products-handlers';

export async function GET(_request, context) {
  return getProduct(_request, context);
}

export async function PATCH(request, context) {
  return patchProduct(request, context);
}
