/**
 * Fine Hub — role + department permission rules.
 *
 * Department access (per user): operations, marketing, products, creatives
 * All About Finecoustic wiki: view all authenticated users; edit master admin only (FCS-建宏)
 * Role (per user): manager | associate | intern
 *
 * Managers have elevated task/campaign permissions inside allowed departments.
 * Team admin (/hub/admin) is master-only (FCS-建宏 + master password).
 */

import { personKey } from '@/lib/appdev';
import { PROTECTED_ASSIGNEE } from '@/lib/appdev-constants';
import { isTaskAssigner } from '@/lib/task-workflow';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';
import {
  canAccessDepartment,
  defaultDepartmentAccess,
  effectiveDepartmentAccess,
  fullDepartmentAccess,
} from '@/lib/hub-departments';
import { ALL_DEPARTMENTS_ID, PERSONAL_DEPARTMENT_ID } from '@/lib/internal';
import { FINEACOUSTIC_WIKI_DEPARTMENT } from '@/lib/knowledge';

export const HUB_ROLES = ['manager', 'associate', 'intern'];

export function isHubAdmin(actor) {
  return Boolean(actor?.isAdmin);
}

export function isHubManager(actor) {
  return Boolean(actor?.isManager || actor?.isAdmin);
}

export function isHubIntern(actor) {
  return actor?.role === 'intern' && !actor?.isAdmin;
}

export function isHubMember(actor) {
  return actor?.role === 'associate' || actor?.role === 'member' || (actor?.role === 'manager' && !actor?.isAdmin);
}

export function actorDepartmentAccess(actor) {
  return effectiveDepartmentAccess(actor);
}

/** Team admin (/hub/admin) — master admin only (not the manager role). */
export function canManageHubUsers(actor) {
  return isHubAdmin(actor);
}

export function canAccessHubDepartment(actor, departmentId) {
  return canAccessDepartment(actor, departmentId);
}

/** Create / edit tasks, milestones, meetings — role gate (use with department scope). */
export function canCreateTask(actor) {
  if (!actor?.ok && !actor?.displayName) return false;
  if (actor.mustChangePassword) return false;
  if (isHubIntern(actor)) return false;
  return true;
}

/** KOL outreach — add from pool / create cards. Any marketing dept access (incl. interns). */
export function canManageKolOutreach(actor) {
  if (!actor?.ok && !actor?.displayName) return false;
  if (actor.mustChangePassword) return false;
  return canAccessDepartment(actor, 'marketing');
}

/** Whether the actor may create a task/milestone in a department (or personal board scope). */
export function canCreateTaskInDepartment(actor, departmentId) {
  if (!canCreateTask(actor)) return false;
  if (isHubAdmin(actor)) return true;

  const dept = String(departmentId || '').trim().toLowerCase();
  if (!dept) return false;
  if (dept === PERSONAL_DEPARTMENT_ID) return true;
  if (dept === ALL_DEPARTMENTS_ID) return false;

  return canAccessDepartment(actor, dept);
}

export function canEditTask(actor, task) {
  if (!canCreateTask(actor)) return false;
  if (isHubManager(actor)) return true;
  return Boolean(task?.id);
}

/**
 * Delete task
 * - Manager: any task
 * - Associate: tasks they created, or private tasks they own
 * - Intern: never
 */
export function canDeleteTask(actor, task) {
  if (!task?.id || !actor?.displayName) return false;
  if (actor.mustChangePassword) return false;

  if (String(task.board_id || '') === KOL_OUTREACH_BOARD_ID) {
    if (isHubIntern(actor)) return false;
    if (!canAccessDepartment(actor, 'marketing')) return false;
    if (isHubManager(actor)) return true;
    if (personKey(task.created_by) === personKey(actor.displayName)) return true;
    if (personKey(task.assignee) === personKey(actor.displayName)) return true;
    return false;
  }

  if (isHubManager(actor)) return true;
  if (isHubIntern(actor)) return false;
  if (personKey(task.created_by) === personKey(actor.displayName)) return true;
  if (
    task.visibility === 'private'
    && personKey(task.owner) === personKey(actor.displayName)
  ) {
    return true;
  }
  return false;
}

/** Task workflow — manager override; interns cannot cancel. */
export function taskWorkflowOptions(actor) {
  return {
    isManager: isHubManager(actor),
    isIntern: isHubIntern(actor),
  };
}

export function canCancelTask(actor, task, actorName) {
  if (isHubIntern(actor)) return false;
  if (isHubManager(actor)) return true;
  return isTaskAssigner(task, actorName);
}

/** Campaign list / flows — managers create; managers or creators delete. */
export function canCreateCampaign(actor) {
  if (!actor?.ok && !actor?.displayName) return false;
  if (actor.mustChangePassword) return false;
  return isHubManager(actor);
}

export function isCampaignCreator(actor, campaign) {
  if (!campaign || !actor?.displayName) return false;
  return personKey(campaign.created_by) === personKey(actor.displayName);
}

export function isBoardCreator(actor, board) {
  if (!board || !actor?.displayName) return false;
  const key = personKey(actor.displayName);
  return personKey(board.created_by) === key || personKey(board.owner_key) === key;
}

export function isSystemBoard(board) {
  return String(board?.id || '') === KOL_OUTREACH_BOARD_ID;
}

/** Delete campaign — managers, or the user who created it. */
export function canDeleteCampaign(actor, campaign) {
  if (!campaign?.id || actor?.mustChangePassword) return false;
  if (isHubIntern(actor)) return false;
  if (isHubManager(actor)) return true;
  return isCampaignCreator(actor, campaign);
}

/** Delete kanban board — managers, or the user who created/owns it. System boards never. */
export function canDeleteBoard(actor, board) {
  if (!board?.id || actor?.mustChangePassword) return false;
  if (isSystemBoard(board)) return false;
  if (isHubIntern(actor)) return false;
  if (isHubManager(actor)) return true;
  return isBoardCreator(actor, board);
}

/** Company wiki (All About Finecoustic) — FCS-建宏 only; everyone else read-only. */
export function canEditFinecousticWiki(actor) {
  if (actor?.mustChangePassword) return false;
  if (!actor?.displayName) return false;
  return personKey(actor.displayName) === personKey(PROTECTED_ASSIGNEE);
}

/** Department jot-down notes — any role with access to that department. */
export function canEditJotDown(actor, departmentId) {
  if (actor.mustChangePassword) return false;
  if (departmentId === FINEACOUSTIC_WIKI_DEPARTMENT) {
    return canEditFinecousticWiki(actor);
  }
  if (isHubAdmin(actor)) return true;
  if (!canAccessDepartment(actor, departmentId)) return false;
  return actor.role === 'manager' || actor.role === 'associate' || actor.role === 'member' || actor.role === 'intern';
}

/** @deprecated use canEditJotDown */
export function canEditKnowledge(actor, departmentId) {
  return canEditJotDown(actor, departmentId);
}

export function canCreateProduct(actor) {
  return isHubManager(actor) && canAccessDepartment(actor, 'products');
}

export function canEditBoardConfig(actor) {
  return isHubManager(actor);
}

/** Build an actor object from /api/auth/me profile (client components). */
export function hubActorFromClient(profile) {
  const hubUser = profile?.hubUser;
  if (!hubUser && !profile?.displayName) return null;
  return {
    ok: true,
    displayName: profile?.displayName || '',
    role: hubUser?.role || 'associate',
    isManager: Boolean(hubUser?.isManager),
    isAdmin: Boolean(hubUser?.isAdmin),
    mustChangePassword: Boolean(hubUser?.mustChangePassword),
    departmentAccess:
      hubUser?.permissions?.departmentAccess
      || hubUser?.departmentAccess
      || (hubUser?.isAdmin ? fullDepartmentAccess() : defaultDepartmentAccess(hubUser?.role)),
  };
}

export function hubPermissionsForClient(actor) {
  if (!actor?.ok) return null;
  return {
    canManageUsers: canManageHubUsers(actor),
    canCreateTask: canCreateTask(actor),
    canManageKolOutreach: canManageKolOutreach(actor),
    canCreateCampaign: canCreateCampaign(actor),
    canEditJotDown: canEditFinecousticWiki(actor),
    canEditWiki: canEditFinecousticWiki(actor),
    canCreateProduct: canCreateProduct(actor),
    canEditBoardConfig: canEditBoardConfig(actor),
    departmentAccess: actorDepartmentAccess(actor),
  };
}

/** Human-readable matrix for admin UI. */
export const HUB_PERMISSION_MATRIX = [
  {
    area: 'Department areas',
    intern: 'Ops / Marketing / Products / Creatives (as assigned)',
    associate: 'Ops / Marketing / Products / Creatives (as assigned)',
    manager: 'Ops / Marketing / Products / Creatives (as assigned)',
  },
  {
    area: 'Team admin (/hub/admin)',
    intern: 'No',
    associate: 'No',
    manager: 'No',
  },
  {
    area: 'Create tasks / milestones',
    intern: 'No',
    associate: 'In allowed depts',
    manager: 'In allowed depts',
  },
  {
    area: 'Delete tasks',
    intern: 'No',
    associate: 'Own tasks only',
    manager: 'In allowed depts',
  },
  {
    area: 'Cancel tasks',
    intern: 'No',
    associate: 'If assigner',
    manager: 'Yes',
  },
  {
    area: 'Task workflow override',
    intern: 'Assignee steps only',
    associate: 'Assigner / assignee rules',
    manager: 'Full override',
  },
  {
    area: 'Create campaigns',
    intern: 'No',
    associate: 'No',
    manager: 'Yes',
  },
  {
    area: 'Delete campaigns',
    intern: 'No',
    associate: 'Own campaigns only',
    manager: 'Yes',
  },
  {
    area: 'Delete kanban boards',
    intern: 'No',
    associate: 'Own boards only',
    manager: 'Yes',
  },
  {
    area: 'Jot down',
    intern: 'In allowed depts',
    associate: 'In allowed depts',
    manager: 'In allowed depts',
  },
  {
    area: 'Add product catalog SKU',
    intern: 'No',
    associate: 'No',
    manager: 'Needs Products access',
  },
  {
    area: 'Edit kanban board columns',
    intern: 'No',
    associate: 'No',
    manager: 'Yes',
  },
];
