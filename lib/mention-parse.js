import { personKey } from '@/lib/appdev';

/** Extract @mentions from comment text against known team display names. */
export function parseMentions(text, knownNames = []) {
  const body = String(text || '');
  if (!body.includes('@') || !knownNames.length) return [];

  const sorted = [...knownNames]
    .map(n => String(n || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const found = [];
  const foundKeys = new Set();
  const lower = body.toLowerCase();

  for (const name of sorted) {
    const needle = `@${name.toLowerCase()}`;
    let idx = 0;
    while (idx < lower.length) {
      const at = lower.indexOf(needle, idx);
      if (at < 0) break;
      const before = at > 0 ? lower[at - 1] : ' ';
      const after = at + needle.length < lower.length ? lower[at + needle.length] : ' ';
      const boundaryBefore = before === ' ' || before === '\n' || before === '(';
      const boundaryAfter = after === ' ' || after === '\n' || after === ',' || after === '.' || after === '!' || after === '?';
      if (boundaryBefore && boundaryAfter) {
        const key = personKey(name);
        if (key && !foundKeys.has(key)) {
          foundKeys.add(key);
          found.push(name);
        }
      }
      idx = at + needle.length;
    }
  }

  return found;
}

/** Non-overlapping @mention spans for display (longest names first). */
export function findMentionSpans(text, knownNames = []) {
  const body = String(text || '');
  if (!body.includes('@') || !knownNames.length) return [];

  const sorted = [...knownNames]
    .map(n => String(n || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const spans = [];
  const lower = body.toLowerCase();

  for (const name of sorted) {
    const needle = `@${name.toLowerCase()}`;
    let idx = 0;
    while (idx < lower.length) {
      const at = lower.indexOf(needle, idx);
      if (at < 0) break;
      const before = at > 0 ? lower[at - 1] : ' ';
      const after = at + needle.length < lower.length ? lower[at + needle.length] : ' ';
      const boundaryBefore = before === ' ' || before === '\n' || before === '(';
      const boundaryAfter =
        after === ' ' || after === '\n' || after === ',' || after === '.' || after === '!' || after === '?';
      if (boundaryBefore && boundaryAfter) {
        spans.push({ start: at, end: at + needle.length, name: body.slice(at, at + needle.length) });
      }
      idx = at + needle.length;
    }
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));
  const merged = [];
  for (const span of spans) {
    const overlaps = merged.some(s => span.start < s.end && span.end > s.start);
    if (!overlaps) merged.push(span);
  }
  return merged.sort((a, b) => a.start - b.start);
}

export function buildMentionKnownNames(teamMembers = [], extraNames = []) {
  const names = new Set();
  for (const n of [...teamMembers, ...extraNames]) {
    const trimmed = String(n || '').trim();
    if (trimmed) names.add(trimmed);
  }
  return [...names];
}
