import { personKey } from '@/lib/appdev';
import { isProtectedAssigner } from '@/lib/appdev-protected';
import {
  KOL_BOARD_PROP,
  normalizeKolOutreachStatus,
  normalizeApproachDirection,
  outreachRowKey,
  parseDealProducts,
  kolOutreachOrderNumber,
} from '@/lib/kol-outreach-shared';
import {
  collectKolCountryOptions,
  collectKolMainPlatformOptions,
  kolMatchesCountryFilter,
  kolMatchesPlatformFilter,
  kolPlatformFilterKey,
} from '@/lib/kol-pool';

export function taskInitiative(task) {
  return String(task?.custom_values?.[KOL_BOARD_PROP.initiative] || '').trim().toLowerCase();
}

export function taskPoolId(task) {
  return String(task?.custom_values?.[KOL_BOARD_PROP.kolPoolId] || '').trim();
}

export function taskApproachDirection(task) {
  return normalizeApproachDirection(task?.custom_values?.[KOL_BOARD_PROP.approachDirection]);
}

export function isOutreachAssignee(task, displayName) {
  const assignee = String(task?.assignee || '').trim();
  if (!assignee || !displayName) return false;
  return personKey(assignee) === personKey(displayName);
}

export function canDragOutreachCard(task, displayName, { isManager = false, isAdmin = false } = {}) {
  const status = normalizeKolOutreachStatus(task?.status);
  if (status === 'no_deal' || status === 'publish') return false;
  if (isManager || isAdmin || isProtectedAssigner(displayName)) return true;
  if (!String(task?.assignee || '').trim()) return false;
  return isOutreachAssignee(task, displayName);
}

export function poolRecordForTask(task, poolRecords = []) {
  const id = taskPoolId(task);
  if (!id) return null;
  return poolRecords.find(record => record.notion_page_id === id) || null;
}

export function daysWaiting(task) {
  const cv = task?.custom_values || {};
  const anchor =
    cv[KOL_BOARD_PROP.approachDate]
    || cv[KOL_BOARD_PROP.followUpDate]
    || task?.updated_at
    || task?.created_at;
  if (!anchor) return null;
  const start = new Date(anchor);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
}

export function needsFollowUp(task) {
  const status = normalizeKolOutreachStatus(task?.status);
  if (status !== 'waiting_response') return false;
  const days = daysWaiting(task);
  return days != null && days >= 3 && !task?.custom_values?.[KOL_BOARD_PROP.followUpDate];
}

export function isNoDealCard(task) {
  return normalizeKolOutreachStatus(task?.status) === 'no_deal';
}

export function kolCardChips(task, poolRecord, t) {
  const cv = task?.custom_values || {};
  const chips = [];
  const country = poolRecord?.country;
  const dealType = cv[KOL_BOARD_PROP.dealType];
  const days = daysWaiting(task);
  const followUp = cv[KOL_BOARD_PROP.followUpDate];
  const publishDate = cv[KOL_BOARD_PROP.publishDate];
  const publishUrl = cv[KOL_BOARD_PROP.publishUrl];

  if (country) {
    chips.push({ key: 'country', label: country, className: 'is-country' });
  }
  if (poolRecord?.kol_category) {
    chips.push({ key: 'category', label: poolRecord.kol_category, className: 'is-category' });
  }
  if (dealType) {
    chips.push({ key: 'deal', label: dealType, className: 'is-deal-type' });
  }
  const orderNumber = kolOutreachOrderNumber(cv);
  if (orderNumber) {
    chips.push({ key: 'order-number', label: orderNumber, className: 'is-order-number' });
  }
  if (needsFollowUp(task)) {
    chips.push({
      key: 'needs-follow-up',
      label: t('hub.campaignKol.chipNeedsFollowUp'),
      className: 'is-follow-up is-due',
    });
  } else if (days != null && normalizeKolOutreachStatus(task?.status) === 'waiting_response') {
    chips.push({
      key: 'days',
      label: t('hub.campaignKol.chipDaysWaiting').replace('{days}', String(days)),
      className: 'is-days',
    });
  }
  if (followUp) {
    chips.push({
      key: 'followup',
      label: t('hub.campaignKol.chipFollowUpDue'),
      className: 'is-follow-up',
    });
  }
  if (publishUrl || publishDate) {
    chips.push({
      key: 'publish',
      label: publishDate || t('hub.campaignKol.statusPublish'),
      className: 'is-publish',
    });
  }
  return chips;
}

export function collectOutreachPlatformOptions(tasks, poolRecords = []) {
  const linkedRecords = [];
  const seen = new Set();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const pool = poolRecordForTask(task, poolRecords);
    const platform = String(pool?.main_platform || '').trim();
    if (!platform) continue;
    const key = kolPlatformFilterKey(platform);
    if (seen.has(key)) continue;
    seen.add(key);
    linkedRecords.push(pool);
  }
  return collectKolMainPlatformOptions(linkedRecords);
}

export function collectOutreachCountryOptions(tasks, poolRecords = []) {
  const linkedRecords = [];
  const seen = new Set();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const pool = poolRecordForTask(task, poolRecords);
    const country = String(pool?.country || '').trim();
    if (!country) continue;
    const key = country.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    linkedRecords.push(pool);
  }
  return collectKolCountryOptions(linkedRecords);
}

export function filterOutreachTasks(tasks, {
  section,
  query,
  initiative,
  assignee,
  dealType,
  platform,
  country,
  approachDirection,
  poolRecords,
}) {
  let rows = tasks.map(task => ({
    ...task,
    status: normalizeKolOutreachStatus(task.status),
  }));

  if (section && section !== 'all') {
    rows = rows.filter(task => task.status === section);
  }
  if (initiative) {
    rows = rows.filter(task => taskInitiative(task) === initiative);
  }
  if (assignee && assignee !== 'all') {
    rows = rows.filter(task => personKey(task.assignee) === personKey(assignee));
  }
  if (dealType && dealType !== 'all') {
    rows = rows.filter(task => task.custom_values?.[KOL_BOARD_PROP.dealType] === dealType);
  }
  if (platform && platform !== 'all') {
    rows = rows.filter(task => kolMatchesPlatformFilter(poolRecordForTask(task, poolRecords), platform));
  }
  if (country && country !== 'all') {
    rows = rows.filter(task => kolMatchesCountryFilter(poolRecordForTask(task, poolRecords), country));
  }
  if (approachDirection && approachDirection !== 'all') {
    rows = rows.filter(task => taskApproachDirection(task) === approachDirection);
  }

  const q = String(query || '').trim().toLowerCase();
  if (!q) return rows;

  return rows.filter(task => {
    const pool = poolRecordForTask(task, poolRecords);
    const cv = task.custom_values || {};
    const hay = [
      task.title,
      task.assignee,
      cv[KOL_BOARD_PROP.dealType],
      cv[KOL_BOARD_PROP.socials],
      cv[KOL_BOARD_PROP.noDealReason],
      kolOutreachOrderNumber(cv),
      pool?.country,
      pool?.main_platform,
      pool?.kol_category,
      taskInitiative(task),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function existingOutreachKeys(tasks) {
  return new Set(
    tasks
      .map(task => outreachRowKey(taskPoolId(task), taskInitiative(task) || 'general'))
      .filter(key => !key.startsWith(':'))
  );
}

export function appendProductsToPoolRecord(poolRecord, productRows, initiative = '') {
  const existing = Array.isArray(poolRecord?.collaboration_products)
    ? poolRecord.collaboration_products
    : [];
  const today = new Date().toISOString().slice(0, 10);
  const additions = (productRows || [])
    .map(row => {
      const product = String(row?.product || '').trim();
      if (!product) return '';
      const qty = Math.max(1, Number(row?.qty) || 1);
      const label = qty > 1 ? `${product} ×${qty}` : product;
      return initiative ? `${label} (${initiative.toUpperCase()}, ${today})` : `${label} (${today})`;
    })
    .filter(Boolean);
  return [...existing, ...additions];
}
