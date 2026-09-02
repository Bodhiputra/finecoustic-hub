/** Build Weibin shipment Excel from outreach cards + KOL pool records (Shopify-style template). */

import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { KOL_BOARD_PROP, parseDealProducts, kolOutreachOrderNumber, weibinExportFilename } from '@/lib/kol-outreach-shared';
import { kolShippingCountryCode, kolShippingRecipientName } from '@/lib/kol-pool';
import { poolRecordForTask } from '@/lib/kol-outreach-utils';

const TEMPLATE_PATH = path.join(process.cwd(), 'assets/templates/kol-weibin-export-template.xlsx');
const SHEET_NAME = 'Single';
const DEFAULT_NOTE = '需要检测';

/** Yellow fill on SO订单号, 国际快递, 跟踪号, 备注 (matches template sample rows). */
const YELLOW_FILL_COLS = [2, 3, 4, 5];

const YELLOW_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
  bgColor: { argb: 'FFFFFF00' },
};

/** Column indexes on the Weibin / Shopify export template (1-based). */
const COL = {
  batch: 1,
  soOrder: 2,
  intlExpress: 3,
  tracking: 4,
  notes: 5,
  email: 6,
  amount: 14,
  shippingFee: 15,
  total: 17,
  qty: 22,
  product: 23,
  recipientName: 40,
  recipientAddress: 41,
  city: 45,
  postcode: 46,
  province: 47,
  country: 48,
  phone: 49,
  noteAttributes: 51,
};

/** Order-level columns merged when a KOL has multiple product rows. */
const MERGE_COLS = [
  COL.batch,
  COL.email,
  COL.recipientName,
  COL.recipientAddress,
  COL.city,
  COL.postcode,
  COL.province,
  COL.country,
  COL.phone,
  COL.noteAttributes,
];

function setCell(row, col, value) {
  if (value === undefined || value === null || value === '') return;
  row.getCell(col).value = value;
}

/** Map deal product labels to Weibin 产品 column names. */
function weibinProductLabel(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return text;
  const lower = text.toLowerCase();
  if (/\bfbs2\b/.test(lower) || lower.includes('nomad l')) return 'Hako Nomad FBS2';
  if (/\bfbs1\b/.test(lower) || lower.includes('hako nomad')) return 'Hako Nomad FBS1';
  return text;
}

function applyYellowFillCells(row) {
  for (const col of YELLOW_FILL_COLS) {
    row.getCell(col).fill = { ...YELLOW_FILL };
  }
}

function recipientAddress(poolRecord = {}) {
  const line1 = String(poolRecord.shipping_line1 || '').trim();
  const line2 = String(poolRecord.shipping_line2 || '').trim();
  return [line1, line2].filter(Boolean).join(', ');
}

function trackingNumber(task) {
  const raw = String(task?.custom_values?.[KOL_BOARD_PROP.trackingLink] || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const hashMatch = url.hash.match(/nums=([^&]+)/i);
    if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);
    const pathPart = url.pathname.split('/').filter(Boolean).pop();
    if (pathPart && /^[A-Za-z0-9-]+$/.test(pathPart)) return pathPart;
  } catch {
    /* plain tracking number */
  }
  return raw;
}

function orderFromTask(task, poolRecord) {
  const cv = task?.custom_values || {};
  const products = parseDealProducts(cv[KOL_BOARD_PROP.dealProducts]);
  const batch = kolOutreachOrderNumber(cv);
  const notes = String(poolRecord?.shipping_notes || '').trim() || DEFAULT_NOTE;

  return {
    batch,
    tracking: trackingNumber(task),
    notes,
    email: String(poolRecord?.shipping_email || '').trim(),
    recipientName: kolShippingRecipientName(poolRecord, task?.title),
    recipientAddress: recipientAddress(poolRecord),
    city: String(poolRecord?.shipping_city || '').trim(),
    postal: String(poolRecord?.shipping_postal || '').trim(),
    state: String(poolRecord?.shipping_state || '').trim(),
    country: kolShippingCountryCode(poolRecord),
    phone: String(poolRecord?.shipping_phone || '').trim(),
    taxId: String(poolRecord?.shipping_tax_id || '').trim(),
    products: products.length ? products : [{ product: '', qty: 1 }],
  };
}

function fillOrderRow(row, order, productLine, isFirstLine) {
  if (isFirstLine) {
    setCell(row, COL.batch, order.batch);
    setCell(row, COL.tracking, order.tracking);
    setCell(row, COL.email, order.email);
    setCell(row, COL.recipientName, order.recipientName);
    setCell(row, COL.recipientAddress, order.recipientAddress);
    setCell(row, COL.city, order.city);
    setCell(row, COL.postcode, order.postal);
    setCell(row, COL.province, order.state);
    setCell(row, COL.country, order.country);
    setCell(row, COL.phone, order.phone);
    setCell(row, COL.noteAttributes, order.taxId ? `tax_id: ${order.taxId}` : '');
  }
  setCell(row, COL.notes, order.notes);
  setCell(row, COL.amount, 0);
  setCell(row, COL.shippingFee, 0);
  setCell(row, COL.total, 0);
  setCell(row, COL.qty, productLine.qty);
  setCell(row, COL.product, weibinProductLabel(productLine.product));
  applyYellowFillCells(row);
}

async function loadTemplateWorkbook() {
  const buffer = await fs.readFile(TEMPLATE_PATH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw new Error('weibin_template_sheet_missing');
  }
  while (sheet.rowCount > 1) {
    sheet.spliceRows(2, 1);
  }
  sheet.model.merges = [];
  return workbook;
}

export async function buildWeibinWorkbook(tasks = [], poolRecords = []) {
  const workbook = await loadTemplateWorkbook();
  const sheet = workbook.getWorksheet(SHEET_NAME);

  const batchCodes = [];
  let rowIndex = 2;

  for (const task of tasks) {
    const pool = poolRecordForTask(task, poolRecords);
    const order = orderFromTask(task, pool);
    if (order.batch) batchCodes.push(order.batch);

    const startRow = rowIndex;
    order.products.forEach((line, index) => {
      const row = sheet.getRow(rowIndex);
      fillOrderRow(row, order, line, index === 0);
      row.commit();
      rowIndex += 1;
    });

    if (order.products.length > 1) {
      const endRow = rowIndex - 1;
      for (const col of MERGE_COLS) {
        sheet.mergeCells(startRow, col, endRow, col);
      }
    }
  }

  const filename = weibinExportFilename(batchCodes);
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
}
