import {
  deleteProductItemHandler,
  getProductItem,
  patchProductItem,
} from '@/lib/api/products-handlers';

export async function GET(_request, context) {
  return getProductItem(_request, context);
}

export async function PATCH(request, context) {
  return patchProductItem(request, context);
}

export async function DELETE(_request, context) {
  return deleteProductItemHandler(_request, context);
}
