import { customerHasTag } from '@/lib/shopify-customer';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function lookupPreorderReserved({ email, tag, secret, expectedSecret }) {
  if (expectedSecret && secret !== expectedSecret) {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } };
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { status: 400, body: { ok: false, error: 'email is required' } };
  }

  const normalizedTag = String(tag || 'nomadpreorder').trim();
  if (!normalizedTag) {
    return { status: 400, body: { ok: false, error: 'tag is required' } };
  }

  try {
    const reserved = await customerHasTag(normalizedEmail, normalizedTag);
    return { status: 200, body: { ok: true, reserved } };
  } catch (err) {
    console.error('[preorder-reserved] lookup failed', err);
    return { status: 500, body: { ok: false, error: 'Server error' } };
  }
}

export function readReservedParams(searchParams, body) {
  const fromQuery = searchParams || new URLSearchParams();
  const payload = body && typeof body === 'object' ? body : {};

  return {
    email: String(payload.email || fromQuery.get('email') || '').trim(),
    tag: String(payload.tag || fromQuery.get('tag') || 'nomadpreorder').trim(),
    secret: String(payload.secret || fromQuery.get('secret') || '').trim(),
  };
}
