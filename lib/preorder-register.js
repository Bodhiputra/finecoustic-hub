import { upsertPreorderLead } from '@/lib/shopify-customer';

function parseBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function readRegisterParams(searchParams, body) {
  const fromQuery = searchParams || new URLSearchParams();
  const payload = body && typeof body === 'object' ? body : {};

  return {
    email: String(payload.email || fromQuery.get('email') || '').trim(),
    acceptsMarketing: parseBool(
      payload.accepts_marketing ?? payload.acceptsMarketing ?? fromQuery.get('accepts_marketing')
    ),
    secret: String(payload.secret || fromQuery.get('secret') || '').trim(),
  };
}

export async function registerPreorderLead({ email, acceptsMarketing, secret, expectedSecret }) {
  if (expectedSecret && secret !== expectedSecret) {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } };
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return { status: 400, body: { ok: false, error: 'email is required' } };
  }

  try {
    const customer = await upsertPreorderLead(normalizedEmail, { acceptsMarketing });
    return {
      status: 200,
      body: {
        ok: true,
        created: !!customer.created,
        customer_id: customer.id,
        email_marketing_state: customer.email_marketing_state,
      },
    };
  } catch (err) {
    console.error('[preorder-register] upsert failed', err);
    return { status: 500, body: { ok: false, error: 'Server error' } };
  }
}
