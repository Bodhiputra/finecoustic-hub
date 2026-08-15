/** Notion API client for KOL POOLS database (read-only sync). */

const NOTION_VERSION = '2022-06-28';

export function getNotionConfig() {
  const apiKey = (process.env.NOTION_API_KEY || '').trim();
  const databaseId = (process.env.NOTION_KOL_DATABASE_ID || '').trim();
  return { apiKey, databaseId };
}

export function notionConfigured() {
  const { apiKey, databaseId } = getNotionConfig();
  return Boolean(apiKey && databaseId);
}

function notionHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

function plainText(rich = []) {
  return rich.map(part => part.plain_text || '').join('').trim();
}

/** Extract a Notion page property by type. */
export function extractNotionProperty(prop) {
  if (!prop || !prop.type) return '';
  switch (prop.type) {
    case 'title':
      return plainText(prop.title);
    case 'rich_text':
      return plainText(prop.rich_text);
    case 'select':
      return prop.select?.name || '';
    case 'status':
      return prop.status?.name || '';
    case 'multi_select':
      return (prop.multi_select || []).map(s => s.name).filter(Boolean).join(', ');
    case 'url':
      return prop.url || '';
    case 'email':
      return prop.email || '';
    case 'number':
      return prop.number != null ? String(prop.number) : '';
    default:
      return '';
  }
}

export function notionPageUrl(pageId) {
  if (!pageId) return '';
  return `https://www.notion.so/${String(pageId).replace(/-/g, '')}`;
}

/** Map a Notion page row to a normalized KOL record. */
export function normalizeNotionKolPage(page) {
  const props = page?.properties || {};
  const pick = name => extractNotionProperty(props[name]);

  const channelName = pick('KOL Channel Name');
  if (!channelName) return null;

  return {
    notion_page_id: page.id,
    channel_name: channelName,
    description: pick('Description'),
    links: pick('Links'),
    main_platform: pick('Main Platform'),
    country: pick('Country'),
    kol_category: pick('KOL Category'),
    tags: pick('Tags'),
    outreach_status: pick('Status'),
    notion_url: notionPageUrl(page.id),
  };
}

async function queryDatabasePage({ apiKey, databaseId, cursor }) {
  const body = { page_size: 100 };
  if (cursor) body.start_cursor = cursor;

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`notion_api_${res.status}`);
    err.status = res.status;
    err.detail = text.slice(0, 500);
    throw err;
  }

  return res.json();
}

/** Fetch all KOL records from Notion (paginated). */
export async function fetchAllKolFromNotion(config = getNotionConfig()) {
  const { apiKey, databaseId } = config;
  if (!apiKey || !databaseId) {
    const err = new Error('notion_not_configured');
    err.status = 503;
    throw err;
  }

  const records = [];
  let cursor = null;

  do {
    const data = await queryDatabasePage({ apiKey, databaseId, cursor });
    for (const page of data.results || []) {
      const row = normalizeNotionKolPage(page);
      if (row) records.push(row);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return records;
}
