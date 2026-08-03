import {
  createProductHandler,
  listProducts,
} from '@/lib/api/products-handlers';

export async function GET() {
  return listProducts();
}

export async function POST(request) {
  return createProductHandler(request);
}
