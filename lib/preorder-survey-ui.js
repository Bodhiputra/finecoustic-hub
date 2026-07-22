/**
 * Questionnaire metadata (mirrors shopify/assets/fc-preorder-questionnaire-data.js).
 * Keep in sync when storefront questions change.
 */
export const SURVEY_QUESTIONS = {
  reserve: [
    {
      id: 'r1',
      short: 'R1',
      title: 'What was the main reason you decided to pre-order Hako Nomad?',
      hint: 'Single choice',
      max: 1,
      options: [
        { letter: 'A', text: 'The design and appearance caught my attention' },
        { letter: 'B', text: 'The features/specifications matched what I was looking for' },
        { letter: 'C', text: 'The pre-order offer and special pricing were attractive' },
        { letter: 'D', text: 'I was looking for a portable speaker for my lifestyle/use case' },
        { letter: 'E', text: 'I wanted to support a new audio brand' },
        { letter: 'F', text: 'Other', other: true },
      ],
    },
    {
      id: 'r2',
      short: 'R2',
      title: 'Compared to other speakers you have seen, what makes Hako Nomad feel different?',
      hint: 'Choose 2 main answers',
      max: 2,
      options: [
        { letter: 'A', text: 'The design feels more unique and recognizable' },
        { letter: 'B', text: 'It feels more like a lifestyle product rather than just a speaker' },
        { letter: 'C', text: 'The overall product presentation feels more premium' },
        { letter: 'D', text: 'The features/specifications feel stronger' },
        { letter: 'E', text: 'The value feels better compared to alternatives' },
        { letter: 'F', text: "I don't see a major difference yet" },
        { letter: 'G', text: 'Other', other: true },
      ],
    },
    {
      id: 'r3',
      short: 'R3',
      title: 'What would you like to see more from Finecoustic in the future?',
      hint: 'Choose 3 main answers',
      max: 3,
      options: [
        { letter: 'A', text: 'More portable speakers' },
        { letter: 'B', text: 'Desktop speakers' },
        { letter: 'C', text: 'Bookshelf speakers' },
        { letter: 'D', text: 'Headphones/headsets' },
        { letter: 'E', text: 'Earbuds' },
        { letter: 'G', text: 'Audio accessories' },
        { letter: 'H', text: 'Other', other: true },
      ],
    },
  ],
  decline: [
    {
      id: 'd1',
      short: 'D1',
      title: 'What was the main reason you decided not to pre-order?',
      hint: 'Choose one',
      max: 1,
      options: [
        { letter: 'A', text: 'I need more information before deciding' },
        { letter: 'B', text: 'I want to compare with other speakers first' },
        { letter: 'C', text: 'The price/value does not meet my expectation' },
        { letter: 'D', text: 'I am unsure about the sound quality' },
        { letter: 'E', text: 'I am unsure about Finecoustic as a new brand' },
        { letter: 'F', text: 'The design does not match my preference' },
        { letter: 'G', text: 'I do not need a speaker currently' },
        { letter: 'H', text: 'Other', other: true },
      ],
    },
    {
      id: 'd2',
      short: 'D2',
      title: "How would you rate Hako Nomad's design?",
      hint: 'Choose one',
      max: 1,
      options: [
        { letter: 'A', text: '1 — Not appealing' },
        { letter: 'B', text: '2 — Slightly appealing' },
        { letter: 'C', text: '3 — Neutral' },
        { letter: 'D', text: '4 — Attractive' },
        { letter: 'E', text: '5 — Very attractive' },
      ],
    },
    {
      id: 'd3',
      short: 'D3',
      title: 'Which statement best describes your hesitation?',
      hint: 'Choose one',
      max: 1,
      options: [
        { letter: 'A', text: 'I like the design, but I am not sure the sound quality is good enough' },
        { letter: 'B', text: "I like the product, but I don't see enough difference compared to existing speakers" },
        { letter: 'C', text: "I like the product, but I don't know enough about Finecoustic yet" },
        { letter: 'D', text: 'I like the product, but the price feels high compared to alternatives' },
        { letter: 'E', text: 'I am interested, but I am not ready to buy a speaker now' },
        { letter: 'F', text: 'None of the above' },
        { letter: 'G', text: 'Other', other: true },
      ],
    },
    {
      id: 'd4',
      short: 'D4',
      title: 'What information would help you feel more confident purchasing Hako Nomad?',
      hint: 'Choose 3 main answers',
      max: 3,
      options: [
        { letter: 'A', text: 'Sound demonstration videos' },
        { letter: 'B', text: 'Real-life usage/lifestyle videos' },
        { letter: 'C', text: 'Reviews from creators or users' },
        { letter: 'D', text: 'More product photos/videos' },
        { letter: 'E', text: 'More details about features and specifications' },
        { letter: 'G', text: 'More information about Finecoustic as a brand' },
        { letter: 'H', text: 'Nothing, I already have enough information' },
        { letter: 'I', text: 'Other', other: true },
      ],
    },
    {
      id: 'd5',
      short: 'D5',
      title: 'When choosing an audio product, what matters most to you?',
      hint: 'Choose 3 main answers',
      max: 3,
      options: [
        { letter: 'A', text: 'Sound quality' },
        { letter: 'B', text: 'Design and aesthetics' },
        { letter: 'C', text: 'Brand reputation' },
        { letter: 'D', text: 'Features and connectivity' },
        { letter: 'E', text: 'Price/value' },
        { letter: 'G', text: 'Build quality/materials' },
        { letter: 'H', text: 'Unique identity/personality' },
      ],
    },
  ],
};

export function getQuestionsForIntent(intent) {
  return SURVEY_QUESTIONS[intent] || [];
}

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

function optionForLetter(question, letter) {
  return question.options.find(opt => opt.letter === String(letter).toUpperCase());
}

function formatFromResponseJson(question, resp) {
  const data = resp || { letters: [], other: '' };
  const letters = Array.isArray(data.letters) ? data.letters : [];

  return letters.map(letter => {
    const opt = optionForLetter(question, letter);
    if (!opt) return String(letter);
    if (opt.other && String(data.other || '').trim()) {
      return `Other: ${String(data.other).trim()}`;
    }
    return opt.text;
  });
}

function parseStoredAnswerText(raw) {
  if (!raw) return [];
  return String(raw)
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const withOther = part.match(/^[A-I]\)\s*Other\s*[—-]\s*(.+)$/i);
      if (withOther) return `Other: ${withOther[1].trim()}`;

      const labeled = part.match(/^[A-I]\)\s*(.+)$/);
      if (labeled) return labeled[1].trim();

      return part;
    });
}

export function answerLabelsFromRow(row, question) {
  const fromJson = row.responses_json?.[question.id];
  if (fromJson) {
    const labels = formatFromResponseJson(question, fromJson);
    if (labels.length) return labels;
  }

  const raw = row[question.id];
  if (raw) {
    const labels = parseStoredAnswerText(raw);
    if (labels.length) return labels;

    const letters = parseAnswerLetters(raw);
    if (letters.length) {
      return letters.map(letter => {
        const opt = optionForLetter(question, letter);
        return opt ? opt.text : letter;
      });
    }
  }

  return [];
}

export function formatAnswerForQuestion(row, question) {
  const labels = answerLabelsFromRow(row, question);
  return labels.length ? labels.join('; ') : '—';
}

export function rowQuestionnaire(row) {
  const questions = getQuestionsForIntent(row.intent);
  return questions.map(question => ({
    id: question.id,
    short: question.short,
    title: question.title,
    answer: formatAnswerForQuestion(row, question),
    answers: answerLabelsFromRow(row, question),
  }));
}

export function lettersFromRow(row, questionId) {
  const question =
    SURVEY_QUESTIONS.reserve.find(q => q.id === questionId) ||
    SURVEY_QUESTIONS.decline.find(q => q.id === questionId);

  if (!question) return parseAnswerLetters(row[questionId]);

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

export function answerBreakdown(rows, question) {
  const counts = {};
  let answered = 0;

  for (const row of rows) {
    const labels = answerLabelsFromRow(row, question);
    if (!labels.length) continue;
    answered += 1;
    for (const label of labels) {
      counts[label] = (counts[label] || 0) + 1;
    }
  }

  const entries = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

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
    'checkout_started',
    'questionnaire',
    'summary',
    'session_id',
    'page_url',
  ];

  const escape = value => {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const formatQuestionnaireCell = row => {
    return rowQuestionnaire(row)
      .map(item => `${item.title}: ${item.answer}`)
      .join('\n');
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map(h => {
          if (h === 'questionnaire') return escape(formatQuestionnaireCell(row));
          return escape(row[h]);
        })
        .join(',')
    );
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
