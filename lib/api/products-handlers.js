import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import { canCreateProduct } from '@/lib/hub-permissions';
import {
  addProductItemComment,
  addProductThreadComment,
  createProduct,
  createProductItem,
  deleteProductItem,
  getProductDetail,
  getProductItemById,
  listProductItems,
  listProductsWithCounts,
  updateProduct,
  updateProductItem,
} from '@/lib/products-data';
import {
  restCreated,
  restError,
  restForbidden,
  restNoContent,
  restNotFound,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function actorError() {
  return restUnauthorized();
}

function requireProductsAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  if (!canAccessDepartment(actor, 'products')) return restForbidden('department_forbidden');
  return null;
}

export async function listProducts(_request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const products = await listProductsWithCounts();
  return restOk({ products, count: products.length });
}

export async function createProductHandler(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;
  if (!canCreateProduct(actor)) return restForbidden('manager_required');

  const body = await request.json().catch(() => ({}));
  try {
    const product = await createProduct(body, actor);
    return restCreated({ product });
  } catch (e) {
    if (e.message === 'sku_taken') return restError('sku_taken', 409);
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function getProduct(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { sku } = await params;
  const detail = await getProductDetail(sku);
  if (!detail) return restNotFound('product_not_found');
  return restOk(detail);
}

export async function patchProduct(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { sku } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const product = await updateProduct(sku, body);
    return restOk({ product });
  } catch (e) {
    if (e.status === 404) return restNotFound('product_not_found');
    throw e;
  }
}

export async function listProductItemsHandler(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { sku } = await params;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') || '';
  try {
    const items = await listProductItems(sku, { kind: kind || undefined });
    return restOk({ items, count: items.length });
  } catch (e) {
    if (e.status === 404) return restNotFound('product_not_found');
    throw e;
  }
}

export async function createProductItemHandler(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { sku } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const item = await createProductItem(sku, body, actor);
    return restCreated({ item });
  } catch (e) {
    if (e.status === 404) return restNotFound('product_not_found');
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function getProductItem(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { id } = await params;
  const item = await getProductItemById(id);
  if (!item) return restNotFound('item_not_found');
  return restOk({ item });
}

export async function patchProductItem(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const item = await updateProductItem(id, body);
    return restOk({ item });
  } catch (e) {
    if (e.status === 404) return restNotFound('item_not_found');
    throw e;
  }
}

export async function deleteProductItemHandler(_request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { id } = await params;
  const deleted = await deleteProductItem(id);
  if (!deleted) return restNotFound('item_not_found');
  return restNoContent();
}

export async function postProductThreadComment(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { sku } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await addProductThreadComment(sku, body, actor);
    return restOk(result);
  } catch (e) {
    if (e.status === 404) return restNotFound('product_not_found');
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}

export async function postProductItemComment(request, { params }) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return actorError();
  }
  const denied = requireProductsAccess(actor);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await addProductItemComment(id, body, actor);
    return restOk(result);
  } catch (e) {
    if (e.status === 404) return restNotFound('item_not_found');
    if (e.status === 400) return restError(e.message, 400);
    throw e;
  }
}
