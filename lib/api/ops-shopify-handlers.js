import { requireHubActor } from '@/lib/hub-actor';
import { canAccessDepartment } from '@/lib/hub-departments';
import {
  isShopifyInventoryConfigured,
  pullShopifyIntoOps,
  pushAxiaAvailableToShopify,
} from '@/lib/ops-shopify-sync';
import {
  restError,
  restForbidden,
  restOk,
  restUnauthorized,
} from '@/lib/api/rest';

function requireOpsAccess(actor) {
  if (actor.mustChangePassword) return restForbidden('must_change_password');
  if (!canAccessDepartment(actor, 'operations')) return restForbidden('department_forbidden');
  return null;
}

function mapShopifyError(err) {
  const code = err.message || 'sync_failed';
  if (code === 'shopify_not_configured') {
    return restError('shopify_not_configured', 503);
  }
  if (code === 'no_axia_quantities') {
    return restError('no_axia_quantities', 400);
  }
  if (code.startsWith('shopify_api_401') || code.startsWith('shopify_api_403')) {
    return restError('shopify_auth_failed', 502, { detail: err.detail });
  }
  if (code === 'variant_not_found') {
    return restError('shopify_variant_not_found', 502);
  }
  return restError('shopify_sync_failed', 502, { detail: err.detail || err.message });
}

export async function postOpsShopifyPull() {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOpsAccess(actor);
  if (denied) return denied;

  if (!isShopifyInventoryConfigured()) {
    return restError('shopify_not_configured', 503);
  }

  try {
    const data = await pullShopifyIntoOps(actor.displayName);
    return restOk({
      ops: data.ops,
      inventory: data.inventory,
      synced_at: data.synced_at,
    });
  } catch (err) {
    return mapShopifyError(err);
  }
}

export async function postOpsShopifyPush() {
  let actor;
  try {
    actor = await requireHubActor();
  } catch {
    return restUnauthorized();
  }

  const denied = requireOpsAccess(actor);
  if (denied) return denied;

  if (!isShopifyInventoryConfigured()) {
    return restError('shopify_not_configured', 503);
  }

  try {
    const data = await pushAxiaAvailableToShopify(actor.displayName);
    return restOk({
      ops: data.ops,
      results: data.results,
      synced_at: data.synced_at,
    });
  } catch (err) {
    return mapShopifyError(err);
  }
}
