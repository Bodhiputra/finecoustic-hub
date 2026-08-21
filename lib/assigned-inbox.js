import { isTaskOverdue, taskDueDate, todayKey } from '@/lib/internal';
import { statusColumnLabel } from '@/lib/internal-campaigns';
import { formatTaskScheduleLabel } from '@/lib/task-datetime';
import { KOL_OUTREACH_BOARD_ID, normalizeKolOutreachStatus } from '@/lib/kol-outreach-shared';
import { taskOriginSummary } from '@/lib/task-origin-url';

const OUTREACH_STATUS_KEYS = {
  not_started: 'hub.campaignKol.statusNotStarted',
  waiting_response: 'hub.campaignKol.statusWaitingResponse',
  deal: 'hub.campaignKol.statusDeal',
  no_deal: 'hub.campaignKol.statusNoDeal',
  quality_control: 'hub.campaignKol.statusQualityControl',
  shipping: 'hub.campaignKol.statusShipping',
  arrived: 'hub.campaignKol.statusArrived',
  publish: 'hub.campaignKol.statusPublish',
};

export function isKolOutreachAssignedTask(task) {
  return task?.board_id === KOL_OUTREACH_BOARD_ID;
}

export function assignedInboxStatusLine(task, t) {
  if (isKolOutreachAssignedTask(task)) {
    const status = normalizeKolOutreachStatus(task.status);
    const key = OUTREACH_STATUS_KEYS[status];
    const label = key ? t(key) : status;
    return t('hub.personal.inboxOutreachStatus').replace('{status}', label);
  }
  return statusColumnLabel({ id: task.status }, t);
}

export function assignedInboxMetaLine(task, t, locale) {
  const parts = [taskOriginSummary(task, t), assignedInboxStatusLine(task, t)];

  if (task.subtype) {
    const subtype = String(task.subtype).trim();
    parts.push(subtype.toLowerCase() === 'kol' ? 'KOL' : subtype);
  }

  if (!isKolOutreachAssignedTask(task)) {
    const due = formatTaskScheduleLabel(
      task.deadline || taskDueDate(task),
      task.deadline_time,
      locale
    );
    if (due) parts.push(due);
  }

  return parts.filter(Boolean).join(' · ');
}

export function assignedInboxOpenLabel(task, t) {
  if (isKolOutreachAssignedTask(task)) {
    return t('hub.personal.inboxOpenOutreach');
  }
  return t('hub.personal.inboxOpen');
}

/** Overdue → in progress → everything else (newest first). */
export function sortAssignedInboxTasks(tasks) {
  const key = todayKey();
  return [...(Array.isArray(tasks) ? tasks : [])].sort((a, b) => {
    const rank = task => {
      if (isTaskOverdue(task, key)) return 0;
      if (task.status === 'in_progress') return 1;
      return 2;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return String(b.updated_at || b.created_at || '').localeCompare(
      String(a.updated_at || a.created_at || '')
    );
  });
}
