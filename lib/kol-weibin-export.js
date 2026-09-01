/** Build Weibin shipment Excel from outreach cards + KOL pool records. */

import ExcelJS from 'exceljs';
import { KOL_BOARD_PROP, parseDealProducts, weibinExportFilename } from '@/lib/kol-outreach-shared';
import { kolShippingSummary } from '@/lib/kol-pool';
import { poolRecordForTask } from '@/lib/kol-outreach-utils';

const HEADERS = [
  'Batch code',
  'Channel',
  'Order number',
  'Products',
  'Address line 1',
  'Address line 2',
  'City',
  'State / region',
  'Postal code',
  'Country',
  'Phone',
  'Email',
  'Shipping notes',
  'Full address',
];

function rowFromTask(task, poolRecord) {
  const cv = task?.custom_values || {};
  const products = parseDealProducts(cv[KOL_BOARD_PROP.dealProducts])
    .map(row => (row.qty > 1 ? `${row.product} ×${row.qty}` : row.product))
    .join(', ');
  return {
    batch: String(cv[KOL_BOARD_PROP.weibinBatchCode] || '').trim(),
    channel: String(poolRecord?.channel_name || task?.title || '').trim(),
    orderNumber: String(cv[KOL_BOARD_PROP.orderNumber] || '').trim(),
    products,
    line1: String(poolRecord?.shipping_line1 || '').trim(),
    line2: String(poolRecord?.shipping_line2 || '').trim(),
    city: String(poolRecord?.shipping_city || '').trim(),
    state: String(poolRecord?.shipping_state || '').trim(),
    postal: String(poolRecord?.shipping_postal || '').trim(),
    country: String(poolRecord?.shipping_country || '').trim(),
    phone: String(poolRecord?.shipping_phone || '').trim(),
    email: String(poolRecord?.shipping_email || '').trim(),
    notes: String(poolRecord?.shipping_notes || '').trim(),
    fullAddress: kolShippingSummary(poolRecord),
  };
}

export async function buildWeibinWorkbook(tasks = [], poolRecords = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fine Hub';
  const sheet = workbook.addWorksheet('Weibin shipment');

  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF2' },
  };

  const batchCodes = [];
  for (const task of tasks) {
    const pool = poolRecordForTask(task, poolRecords);
    const data = rowFromTask(task, pool);
    if (data.batch) batchCodes.push(data.batch);
    sheet.addRow([
      data.batch,
      data.channel,
      data.orderNumber,
      data.products,
      data.line1,
      data.line2,
      data.city,
      data.state,
      data.postal,
      data.country,
      data.phone,
      data.email,
      data.notes,
      data.fullAddress,
    ]);
  }

  sheet.columns.forEach(col => {
    col.width = 18;
  });
  sheet.getColumn(4).width = 28;
  sheet.getColumn(14).width = 36;

  const filename = weibinExportFilename(batchCodes);
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
}
