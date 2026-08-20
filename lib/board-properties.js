/** Custom board field types (Notion-style properties on task nodes). */

export const BOARD_FIELD_TYPES = ['text', 'link', 'date', 'select', 'person'];

export function newBoardPropertyId() {
  return `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeBoardProperty(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = BOARD_FIELD_TYPES.includes(raw.type) ? raw.type : 'text';
  const id = String(raw.id || newBoardPropertyId()).trim().slice(0, 64);
  const label = String(raw.label || '').trim().slice(0, 80) || 'Field';
  const options = Array.isArray(raw.options)
    ? raw.options.map(o => String(o || '').trim()).filter(Boolean).slice(0, 24)
    : [];
  return { id, type, label, options };
}

export function normalizeBoardProperties(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const prop = normalizeBoardProperty(item);
    if (!prop || seen.has(prop.id)) continue;
    seen.add(prop.id);
    out.push(prop);
  }
  return out.slice(0, 20);
}

export function normalizeCustomValues(raw, properties = []) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const allowed = new Set((properties || []).map(p => p.id));
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (!allowed.has(key)) continue;
    if (value == null || value === '') continue;
    out[key] = String(value).slice(0, 2000);
  }
  return out;
}

export function boardFieldTypeLabel(type, t) {
  const key = {
    text: 'hub.internal.fieldTypeText',
    link: 'hub.internal.fieldTypeLink',
    date: 'hub.internal.fieldTypeDate',
    select: 'hub.internal.fieldTypeSelect',
    person: 'hub.internal.fieldTypePerson',
  }[type];
  return key && t ? t(key) : type;
}
