import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const ROOT = process.cwd();
const FILE_PATH = join(ROOT, 'data', 'preorder-survey-responses.json');

let tableReady = false;
let tableReadyPromise = null;

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS preorder_survey_responses (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        intent TEXT NOT NULL,
        email TEXT,
        accepts_marketing BOOLEAN,
        r1 TEXT,
        r2 TEXT,
        r3 TEXT,
        d1 TEXT,
        d2 TEXT,
        d3 TEXT,
        d4 TEXT,
        d5 TEXT,
        summary TEXT,
        session_id TEXT,
        checkout_started BOOLEAN NOT NULL DEFAULT FALSE,
        page_url TEXT,
        responses_json JSONB
      )
    `
      .then(() => sql()`
        CREATE INDEX IF NOT EXISTS preorder_survey_responses_created_at_idx
        ON preorder_survey_responses (created_at DESC)
      `)
      .then(() => sql()`
        CREATE INDEX IF NOT EXISTS preorder_survey_responses_intent_idx
        ON preorder_survey_responses (intent)
      `)
      .then(() => sql()`
        CREATE UNIQUE INDEX IF NOT EXISTS preorder_survey_responses_email_intent_uniq
        ON preorder_survey_responses (LOWER(TRIM(email)), intent)
        WHERE email IS NOT NULL AND TRIM(email) <> ''
      `)
      .then(() => {
        tableReady = true;
      })
      .catch(err => {
        tableReadyPromise = null;
        throw err;
      });
  }
  await tableReadyPromise;
}

export class DuplicatePreorderSurveyError extends Error {
  constructor(intent, email, existingId) {
    super(`Duplicate ${intent} survey for ${email}`);
    this.name = 'DuplicatePreorderSurveyError';
    this.intent = intent;
    this.email = email;
    this.existingId = existingId;
  }
}

export function normalizeSurveyEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized ? normalized.slice(0, 320) : '';
}

function readFileRows() {
  if (!existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(FILE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeFileRows(rows) {
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(FILE_PATH, JSON.stringify(rows, null, 2));
}

function normalizeRow(payload) {
  return {
    created_at: new Date().toISOString(),
    intent: String(payload.intent || '').slice(0, 32),
    email: normalizeSurveyEmail(payload.email),
    accepts_marketing: Boolean(payload.accepts_marketing),
    r1: payload.r1 || null,
    r2: payload.r2 || null,
    r3: payload.r3 || null,
    d1: payload.d1 || null,
    d2: payload.d2 || null,
    d3: payload.d3 || null,
    d4: payload.d4 || null,
    d5: payload.d5 || null,
    summary: payload.summary || null,
    session_id: payload.session_id || null,
    checkout_started: Boolean(payload.checkout_started),
    page_url: payload.page_url || null,
    responses_json: payload.responses || null,
  };
}

export async function findPreorderSurveyByEmailIntent(email, intent) {
  const normalized = normalizeSurveyEmail(email);
  if (!normalized || (intent !== 'reserve' && intent !== 'decline')) return null;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, created_at, intent, email
      FROM preorder_survey_responses
      WHERE LOWER(TRIM(email)) = ${normalized}
        AND intent = ${intent}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] ? serializeRow(rows[0]) : null;
  }

  const rows = readFileRows();
  const match = rows.find(
    r => r.intent === intent && normalizeSurveyEmail(r.email) === normalized
  );
  return match ? serializeRow(match) : null;
}

export async function insertPreorderSurveyResponse(payload) {
  const row = normalizeRow(payload);

  if (row.email) {
    const existing = await findPreorderSurveyByEmailIntent(row.email, row.intent);
    if (existing) {
      throw new DuplicatePreorderSurveyError(row.intent, row.email, existing.id);
    }
  }

  if (useDatabase()) {
    await ensureTable();
    try {
      const inserted = await sql()`
        INSERT INTO preorder_survey_responses (
          intent, email, accepts_marketing,
          r1, r2, r3, d1, d2, d3, d4, d5,
          summary, session_id, checkout_started, page_url, responses_json
        ) VALUES (
          ${row.intent},
          ${row.email},
          ${row.accepts_marketing},
          ${row.r1},
          ${row.r2},
          ${row.r3},
          ${row.d1},
          ${row.d2},
          ${row.d3},
          ${row.d4},
          ${row.d5},
          ${row.summary},
          ${row.session_id},
          ${row.checkout_started},
          ${row.page_url},
          ${row.responses_json ? JSON.stringify(row.responses_json) : null}::jsonb
        )
        RETURNING id, created_at
      `;
      return inserted[0];
    } catch (err) {
      if (err?.code === '23505') {
        const existing = await findPreorderSurveyByEmailIntent(row.email, row.intent);
        throw new DuplicatePreorderSurveyError(
          row.intent,
          row.email,
          existing?.id
        );
      }
      throw err;
    }
  }

  const rows = readFileRows();
  const id = rows.length ? Math.max(...rows.map(r => r.id || 0)) + 1 : 1;
  const record = { id, ...row };
  rows.unshift(record);
  writeFileRows(rows);
  return { id, created_at: record.created_at };
}

function serializeRow(row) {
  return {
    ...row,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  };
}

export async function listPreorderSurveyResponses({ limit = 200, intent } = {}) {
  const capped = Math.min(Math.max(1, limit), 500);

  if (useDatabase()) {
    await ensureTable();
    const rows = intent
      ? await sql()`
        SELECT id, created_at, intent, email, accepts_marketing,
               r1, r2, r3, d1, d2, d3, d4, d5,
               summary, session_id, checkout_started, page_url, responses_json
        FROM preorder_survey_responses
        WHERE intent = ${intent}
        ORDER BY created_at DESC
        LIMIT ${capped}
      `
      : await sql()`
        SELECT id, created_at, intent, email, accepts_marketing,
               r1, r2, r3, d1, d2, d3, d4, d5,
               summary, session_id, checkout_started, page_url, responses_json
        FROM preorder_survey_responses
        ORDER BY created_at DESC
        LIMIT ${capped}
      `;
    return rows.map(serializeRow);
  }

  let rows = readFileRows();
  if (intent) rows = rows.filter(r => r.intent === intent);
  return rows.slice(0, capped).map(serializeRow);
}

/** Delete all saved questionnaire responses (Neon or local JSON). */
export async function clearPreorderSurveyResponses() {
  if (useDatabase()) {
    await ensureTable();
    const deleted = await sql()`
      DELETE FROM preorder_survey_responses
      RETURNING id
    `;
    return { deleted: deleted.length, storage: 'database' };
  }

  const rows = readFileRows();
  writeFileRows([]);
  return { deleted: rows.length, storage: 'file' };
}
