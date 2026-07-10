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
