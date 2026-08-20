import {
  ALL_DEPARTMENTS_ID,
  PERSONAL_DEPARTMENT_ID,
  deptText,
  getDepartment,
  getDepartmentPath,
  normalizeDepartmentId,
} from '@/lib/internal';
import {
  campaignBoardUrl,
  campaignFlowUrl,
  departmentBoardUrl,
  marketingKolOutreachUrl,
  personalBoardUrl,
} from '@/lib/campaign-urls';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';

function appendTaskParam(url, taskId) {
  if (!taskId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}task=${encodeURIComponent(taskId)}`;
}

/** Navigate to where a task lives — optional ?task= id opens the task panel on arrival. */
export function taskOriginUrl(task, { openTask = true } = {}) {
  if (!task?.id) return '/me';

  const taskId = openTask ? task.id : '';

  if (task.board_id) {
    if (task.board_id === KOL_OUTREACH_BOARD_ID) {
      return appendTaskParam(marketingKolOutreachUrl(), taskId);
    }
    if (task.campaign_id) {
      return appendTaskParam(campaignBoardUrl(task.board_id, 'board'), taskId);
    }
    const dept = normalizeDepartmentId(task.department);
    if (dept === PERSONAL_DEPARTMENT_ID) {
      return appendTaskParam(personalBoardUrl(task.board_id, 'board'), taskId);
    }
    const deptPath = getDepartmentPath(dept);
    return appendTaskParam(departmentBoardUrl(deptPath, task.board_id, 'board'), taskId);
  }

  if (task.campaign_id) {
    return appendTaskParam(campaignFlowUrl(task.campaign_id, 'flow'), taskId);
  }

  const dept = normalizeDepartmentId(task.department);
  if (dept === PERSONAL_DEPARTMENT_ID || dept === ALL_DEPARTMENTS_ID) {
    return appendTaskParam('/', taskId);
  }

  const deptPath = getDepartmentPath(dept);
  return appendTaskParam(`${deptPath}?view=list`, taskId);
}

/** Short label for assigned-to-me list rows. */
export function taskOriginSummary(task, t) {
  if (!task) return '';

  if (task.board_id === KOL_OUTREACH_BOARD_ID) {
    return t('hub.campaignKol.nav');
  }

  if (task.board_id && task.campaign_id) {
    return t('hub.personal.taskOriginCampaignBoard');
  }

  if (task.board_id) {
    const dept = normalizeDepartmentId(task.department);
    if (dept === PERSONAL_DEPARTMENT_ID) {
      return t('hub.personal.taskOriginPersonalBoard');
    }
    const department = getDepartment(dept);
    if (department) {
      return `${deptText(department, t, 'label')} · ${t('hub.internal.viewBoard')}`;
    }
    return t('hub.internal.viewBoard');
  }

  if (task.campaign_id) {
    return t('hub.personal.taskOriginCampaignFlow');
  }

  const dept = normalizeDepartmentId(task.department);
  if (dept === ALL_DEPARTMENTS_ID) {
    return t('hub.internal.scheduleDashboard');
  }

  const department = getDepartment(dept);
  return department ? deptText(department, t, 'label') : t('hub.internal.sectionTasks');
}
