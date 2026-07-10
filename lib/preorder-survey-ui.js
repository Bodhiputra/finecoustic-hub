/** Question labels for breakdown charts (mirrors Shopify FC_PREORDER_SURVEY). */
export const SURVEY_QUESTIONS = {
  reserve: [
    { id: 'r1', title: 'Main reason to preorder', short: 'R1' },
    { id: 'r2', title: 'What makes Nomad feel different', short: 'R2' },
    { id: 'r3', title: 'What to see more from Finecoustic', short: 'R3' },
  ],
  decline: [
    { id: 'd1', title: 'Main reason not to preorder', short: 'D1' },
    { id: 'd2', title: 'Design rating', short: 'D2' },
    { id: 'd3', title: 'Hesitation', short: 'D3' },
    { id: 'd4', title: 'Info that would help', short: 'D4' },
    { id: 'd5', title: 'What matters most', short: 'D5' },
  ],
};

export function parseAnswerLetters(value) {
  if (!value) return [];
  if (typeof value === 'object' && Array.isArray(value.letters)) {
    return value.letters.map(l => String(l).toUpperCase());
  }
  const text = String(value);
  const matches = text.match(/(?:^|[;\s])([A-I])\)/g);
  if (matches) {
    return matches.map(m => m.replace(/[^A-I]/g, '').toUpperCase());
  }
  const single = text.match(/^([A-I])(?:\)|\s|$)/);
  return single ? [single[1].toUpperCase()] : [];
}

export function lettersFromRow(row, questionId) {
  const fromJson = row.responses_json?.[questionId];
  if (fromJson) {
    const letters = parseAnswerLetters(fromJson);
    if (letters.length) return letters;
  }
  return parseAnswerLetters(row[questionId]);
}

export function calcSurveyStats(rows) {
  const total = rows.length;
  const reserve = rows.filter(r => r.intent === 'reserve').length;
  const decline = rows.filter(r => r.intent === 'decline').length;
  const checkoutStarted = rows.filter(r => r.checkout_started).length;
  const marketingOptIn = rows.filter(r => r.accepts_marketing).length;
  const reserveRows = rows.filter(r => r.intent === 'reserve');
  const checkoutRate = reserveRows.length
    ? Math.round((reserveRows.filter(r => r.checkout_started).length / reserveRows.length) * 100)
    : 0;

  return {
    total,
    reserve,
    decline,
    checkoutStarted,
    marketingOptIn,
    checkoutRate,
  };
}

export function answerBreakdown(rows, questionId) {
  const counts = {};
  let answered = 0;

  for (const row of rows) {
    const letters = lettersFromRow(row, questionId);
    if (!letters.length) continue;
    answered += 1;
    for (const letter of letters) {
      counts[letter] = (counts[letter] || 0) + 1;
    }
  }

  const entries = Object.entries(counts)
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => b.count - a.count || a.letter.localeCompare(b.letter));

  const max = entries.reduce((m, e) => Math.max(m, e.count), 0);

  return { answered, entries, max };
}

export function filterSurveyRows(rows, { intent = 'all', from = '', to = '' } = {}) {
  return rows.filter(row => {
    if (intent !== 'all' && row.intent !== intent) return false;

    if (from || to) {
      const ts = new Date(row.created_at).getTime();
      if (Number.isNaN(ts)) return false;
      if (from) {
        const start = new Date(`${from}T00:00:00`).getTime();
        if (ts < start) return false;
      }
      if (to) {
        const end = new Date(`${to}T23:59:59.999`).getTime();
        if (ts > end) return false;
      }
    }

    return true;
  });
}

export function formatSurveyTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(text, max = 80) {
  const s = String(text || '').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function rowsToCsv(rows) {
  const headers = [
    'id',
    'created_at',
    'intent',
    'email',
    'accepts_marketing',
    'r1',
    'r2',
    'r3',
    'd1',
    'd2',
    'd3',
    'd4',
    'd5',
    'summary',
    'checkout_started',
    'session_id',
    'page_url',
  ];

  const escape = value => {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
