const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

function shopifyConfig() {
  const token = (process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
  const store = (process.env.SHOPIFY_STORE || '').trim();
  if (!token || !store) return null;
  return { token, store };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
  }
  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export async function customerHasTag(email, tag) {
  const config = shopifyConfig();
  const normalizedEmail = normalizeEmail(email);
  const normalizedTag = String(tag || '').trim().toLowerCase();

  if (!config || !normalizedEmail || !normalizedTag) {
    return false;
  }

  const query = encodeURIComponent(`email:${normalizedEmail}`);
  const url = `https://${config.store}/admin/api/${API_VERSION}/customers/search.json?query=${query}&fields=id,email,tags&limit=5`;

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': config.token,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Shopify customer search failed (${response.status})`);
  }

  const data = await response.json();
  const customers = data.customers || [];
  const match = customers.find((customer) => normalizeEmail(customer.email) === normalizedEmail);

  if (!match) return false;

  return parseTags(match.tags).includes(normalizedTag);
}

function adminHeaders(token) {
  return {
    'X-Shopify-Access-Token': token,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function marketingConsentPayload(acceptsMarketing) {
  return {
    state: acceptsMarketing ? 'subscribed' : 'pending',
    opt_in_level: 'single_opt_in',
    consent_updated_at: new Date().toISOString(),
  };
}

function currentMarketingState(customer) {
  const consent = customer?.email_marketing_consent;
  if (!consent || !consent.state) return null;
  return String(consent.state).toLowerCase();
}

export async function findCustomerByEmail(email) {
  const config = shopifyConfig();
  const normalizedEmail = normalizeEmail(email);

  if (!config || !normalizedEmail) {
    return null;
  }

  const query = encodeURIComponent(`email:${normalizedEmail}`);
  const url = `https://${config.store}/admin/api/${API_VERSION}/customers/search.json?query=${query}&fields=id,email,tags,email_marketing_consent&limit=5`;

  const response = await fetch(url, {
    headers: adminHeaders(config.token),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Shopify customer search failed (${response.status})`);
  }

  const data = await response.json();
  const customers = data.customers || [];
  return customers.find((customer) => normalizeEmail(customer.email) === normalizedEmail) || null;
}

async function createCustomer(config, email, acceptsMarketing) {
  const consent = marketingConsentPayload(acceptsMarketing);
  const url = `https://${config.store}/admin/api/${API_VERSION}/customers.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: adminHeaders(config.token),
    body: JSON.stringify({
      customer: {
        email,
        email_marketing_consent: consent,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Shopify customer create failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return {
    id: data.customer?.id,
    created: true,
    email_marketing_state: consent.state,
  };
}

async function updateCustomerMarketing(config, customerId, acceptsMarketing, existingState) {
  let state = acceptsMarketing ? 'subscribed' : 'pending';
  if (!acceptsMarketing && existingState === 'subscribed') {
    state = 'subscribed';
  }

  const consent = {
    ...marketingConsentPayload(acceptsMarketing),
    state,
  };

  const url = `https://${config.store}/admin/api/${API_VERSION}/customers/${customerId}.json`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: adminHeaders(config.token),
    body: JSON.stringify({
      customer: {
        id: customerId,
        email_marketing_consent: consent,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Shopify customer update failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return {
    id: data.customer?.id || customerId,
    created: false,
    email_marketing_state: consent.state,
  };
}

export async function upsertPreorderLead(email, { acceptsMarketing = false } = {}) {
  const config = shopifyConfig();
  const normalizedEmail = normalizeEmail(email);

  if (!config || !normalizedEmail) {
    throw new Error('Shopify customer config or email missing');
  }

  const existing = await findCustomerByEmail(normalizedEmail);
  if (existing?.id) {
    return updateCustomerMarketing(
      config,
      existing.id,
      acceptsMarketing,
      currentMarketingState(existing)
    );
  }

  return createCustomer(config, normalizedEmail, acceptsMarketing);
}
