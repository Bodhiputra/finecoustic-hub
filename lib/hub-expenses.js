import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { EXPENSE_STATUSES } from '@/lib/hub-expenses-constants';

export { EXPENSE_STATUSES } from '@/lib/hub-expenses-constants';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-expenses.json');

let tableReady = false;
let tableReadyPromise = null;

function sql() {
  return getNeonSql();
}

function useDatabase() {
  return hasDatabase();
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS hub_expenses (
        id TEXT PRIMARY KEY,
        expense_date DATE NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        reimbursement_status TEXT NOT NULL DEFAULT 'pending',
        created_by TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(() => sql()`CREATE INDEX IF NOT EXISTS hub_expenses_date_idx ON hub_expenses (expense_date DESC)`)
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

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ items: [] }, null, 2));
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.items) ? raw.items : [];
}

function writeFileStore(items) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ items }, null, 2));
}

export function normalizeExpense(row = {}) {
  const status = EXPENSE_STATUSES.includes(row.reimbursement_status)
    ? row.reimbursement_status
    : 'pending';
  return {
    id: String(row.id || ''),
    expense_date: row.expense_date || row.date || null,
    category: String(row.category || '').trim(),
    description: String(row.description || '').trim(),
    amount: Number(row.amount) || 0,
    currency: String(row.currency || 'USD').trim().toUpperCase(),
    reimbursement_status: status,
    created_by: String(row.created_by || '').trim(),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function listExpenses({ limit = 500 } = {}) {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT * FROM hub_expenses
      ORDER BY expense_date DESC, created_at DESC
      LIMIT ${Math.min(Math.max(limit, 1), 2000)}
    `;
    return rows.map(normalizeExpense);
  }
  return readFileStore()
    .map(normalizeExpense)
    .sort((a, b) => String(b.expense_date).localeCompare(String(a.expense_date)));
}

export async function createExpense(body = {}, actorName = '') {
  const expense = normalizeExpense({
    id: randomUUID(),
    expense_date: body.expense_date || body.date,
    category: body.category,
    description: body.description,
    amount: body.amount,
    currency: body.currency,
    reimbursement_status: body.reimbursement_status || 'pending',
    created_by: actorName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!expense.expense_date || !expense.description) {
    const err = new Error('invalid_payload');
    err.status = 400;
    throw err;
  }

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      INSERT INTO hub_expenses (
        id, expense_date, category, description, amount, currency,
        reimbursement_status, created_by, created_at, updated_at
      ) VALUES (
        ${expense.id}, ${expense.expense_date}, ${expense.category}, ${expense.description},
        ${expense.amount}, ${expense.currency}, ${expense.reimbursement_status},
        ${expense.created_by}, ${expense.created_at}, ${expense.updated_at}
      )
    `;
  } else {
    const items = readFileStore();
    items.push(expense);
    writeFileStore(items);
  }

  return expense;
}

export async function updateExpense(id, patch = {}) {
  const expenseId = String(id || '').trim();
  if (!expenseId) {
    const err = new Error('invalid_id');
    err.status = 400;
    throw err;
  }

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`SELECT * FROM hub_expenses WHERE id = ${expenseId} LIMIT 1`;
    if (!rows.length) {
      const err = new Error('not_found');
      err.status = 404;
      throw err;
    }
    const merged = normalizeExpense({
      ...rows[0],
      ...patch,
      id: expenseId,
      updated_at: new Date().toISOString(),
    });
    await sql()`
      UPDATE hub_expenses SET
        expense_date = ${merged.expense_date},
        category = ${merged.category},
        description = ${merged.description},
        amount = ${merged.amount},
        currency = ${merged.currency},
        reimbursement_status = ${merged.reimbursement_status},
        updated_at = ${merged.updated_at}
      WHERE id = ${expenseId}
    `;
    return merged;
  }

  const items = readFileStore();
  const idx = items.findIndex(e => e.id === expenseId);
  if (idx < 0) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const merged = normalizeExpense({
    ...items[idx],
    ...patch,
    id: expenseId,
    updated_at: new Date().toISOString(),
  });
  items[idx] = merged;
  writeFileStore(items);
  return merged;
}

export function expensesToCsv(expenses) {
  const header = 'Date,Category,Description,Amount,Currency,Status,Created by';
  const lines = expenses.map(e =>
    [
      e.expense_date,
      csvCell(e.category),
      csvCell(e.description),
      e.amount,
      e.currency,
      e.reimbursement_status,
      csvCell(e.created_by),
    ].join(',')
  );
  return [header, ...lines].join('\n');
}

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
