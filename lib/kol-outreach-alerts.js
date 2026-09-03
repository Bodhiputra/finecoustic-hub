import { personKey } from '@/lib/appdev';
import { clearHubNotificationsForEntity, createHubNotification } from '@/lib/hub-notifications';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';
import { listKolOutreachLegacyNoReplyTasks, listKolOutreachTasksForAlerts, systemUpdateTask } from '@/lib/internal-data';
import {
  KOL_BOARD_PROP,
  kolOutreachBoardUrl,
  normalizeKolOutreachStatus,
} from '@/lib/kol-outreach-shared';

const AUTO_NO_DEAL_REASON = 'KOL not replying';

function daysSince(iso, now = new Date()) {
  if (!iso) return null;
  const start = new Date(String(iso).slice(0, 10));
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

/** ISO week key for weekly dedupe (Mon-start week). */
function isoWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function taskInitiativeId(task) {
  const raw = String(task?.custom_values?.[KOL_BOARD_PROP.initiative] || '').trim().toLowerCase();
  if (raw === 'fbs' || raw === 'fbb') return raw;
  if (raw.includes('fbs')) return 'fbs';
  if (raw.includes('fbb')) return 'fbb';
  return '';
}

/** Reminder types that should not persist after the card leaves the matching pipeline step. */
export function staleKolOutreachNotificationTypes(task) {
  const status = normalizeKolOutreachStatus(task?.status);
  const cv = task?.custom_values || {};
  const stale = [];

  if (status !== 'waiting_response' || cv[KOL_BOARD_PROP.followUpDate]) {
    stale.push('kol_waiting_3d');
  }

  if (status !== 'arrived') {
    stale.push('kol_arrived_weekly');
  }

  if (status !== 'shipping') {
    stale.push('kol_tracking_3d');
  } else {
    const mediaSent = cv[KOL_BOARD_PROP.mediaKitSent] === 'yes';
    const trackingSent = cv[KOL_BOARD_PROP.trackingSent] === 'yes';
    if (!mediaSent || trackingSent) {
      stale.push('kol_tracking_3d');
    }
  }

  return stale;
}

export async function dismissStaleKolOutreachNotifications(task) {
  if (!task?.id) return 0;
  if (String(task.board_id || '') !== KOL_OUTREACH_BOARD_ID) return 0;
  if (task.kind === 'meeting') return 0;
  const types = staleKolOutreachNotificationTypes(task);
  if (!types.length) return 0;
  return clearHubNotificationsForEntity(task.id, 'task', types);
}

export async function dismissAllStaleKolOutreachNotifications(tasks = []) {
  let cleared = 0;
  for (const task of tasks) {
    cleared += await dismissStaleKolOutreachNotifications(task);
  }
  return cleared;
}

async function notifyAssignee(task, { type, dedupeKey, payload = {} }) {
  const assignee = String(task.assignee || '').trim();
  if (!assignee) return 0;
  const initiative = taskInitiativeId(task);
  const n = await createHubNotification({
    recipientName: assignee,
    type,
    entityType: 'task',
    entityId: task.id,
    title: task.title || 'KOL',
    actorName: '',
    payload: {
      ...payload,
      initiative,
      url: kolOutreachBoardUrl(initiative),
    },
    dedupeKey,
  });
  return n ? 1 : 0;
}

/** Waiting reminders, auto no-deal, and weekly arrived nudges for KOL outreach tasks. */
export async function processKolOutreachAlerts(now = new Date()) {
  const tasks = await listKolOutreachTasksForAlerts();
  let sent = 0;
  let autoMoved = 0;
  const cleared = await dismissAllStaleKolOutreachNotifications(tasks);

  for (const task of tasks) {
    const status = normalizeKolOutreachStatus(task.status);
    const cv = task.custom_values || {};

    if (status === 'waiting_response') {
      const approachDate = cv[KOL_BOARD_PROP.approachDate];
      const followUpDate = cv[KOL_BOARD_PROP.followUpDate];
      const days = daysSince(approachDate || task.updated_at || task.created_at, now);

      if (!followUpDate && days != null && days >= 3) {
        sent += await notifyAssignee(task, {
          type: 'kol_waiting_3d',
          dedupeKey: `kol_waiting_3d:${task.id}:${personKey(task.assignee)}:${approachDate || task.id}`,
          payload: { days_waiting: days },
        });
      }

      if (followUpDate) {
        const daysAfterFollowUp = daysSince(followUpDate, now);
        if (daysAfterFollowUp != null && daysAfterFollowUp >= 2) {
          await systemUpdateTask(task.id, {
            status: 'no_deal',
            custom_values: {
              ...cv,
              [KOL_BOARD_PROP.noDealReason]: AUTO_NO_DEAL_REASON,
            },
          });
          autoMoved += 1;
          sent += await notifyAssignee(task, {
            type: 'kol_auto_no_deal',
            dedupeKey: `kol_auto_no_deal:${task.id}:${personKey(task.assignee)}:${followUpDate}`,
            payload: { reason: AUTO_NO_DEAL_REASON },
          });
        }
      }
    }

    if (status === 'arrived') {
      const weekKey = isoWeekKey(now);
      sent += await notifyAssignee(task, {
        type: 'kol_arrived_weekly',
        dedupeKey: `kol_arrived_weekly:${task.id}:${personKey(task.assignee)}:${weekKey}`,
      });
    }

    if (status === 'shipping') {
      const mediaSent = cv[KOL_BOARD_PROP.mediaKitSent] === 'yes';
      const trackingSent = cv[KOL_BOARD_PROP.trackingSent] === 'yes';
      const anchor = cv[KOL_BOARD_PROP.mediaKitSentAt] || cv[KOL_BOARD_PROP.shippingDate];
      if (mediaSent && !trackingSent && anchor) {
        const days = daysSince(anchor, now);
        if (days != null && days >= 3) {
          sent += await notifyAssignee(task, {
            type: 'kol_tracking_3d',
            dedupeKey: `kol_tracking_3d:${task.id}:${personKey(task.assignee)}:${anchor}`,
            payload: { days_waiting: days },
          });
        }
      }
    }
  }

  return { sent, autoMoved, cleared, boardId: KOL_OUTREACH_BOARD_ID };
}

/** One-time migration: legacy no_reply → no_deal on outreach board tasks. */
export async function migrateKolOutreachLegacyStatuses() {
  const legacy = await listKolOutreachLegacyNoReplyTasks();
  if (!legacy.length) return 0;
  let migrated = 0;
  for (const task of legacy) {
    await systemUpdateTask(task.id, { status: 'no_deal' });
    migrated += 1;
  }
  return migrated;
}
