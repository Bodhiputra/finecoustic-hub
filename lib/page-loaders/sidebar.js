import { listBoardsForDepartment, listPersonalBoardsForActor } from '@/lib/internal-campaigns-data';
import { departmentKanbansEnabled, PERSONAL_DEPARTMENT_ID } from '@/lib/internal';
import { filterSidebarBoards } from '@/lib/sidebar-boards';

export { filterSidebarBoards } from '@/lib/sidebar-boards';

export async function loadDepartmentSidebarBoards(departmentId, actor) {
  if (!departmentKanbansEnabled(departmentId) || !actor?.ok) return [];
  const boards = await listBoardsForDepartment(departmentId);
  return filterSidebarBoards(boards);
}

export async function loadPersonalSidebarBoards(actor) {
  if (!actor?.ok) return [];
  const boards = await listPersonalBoardsForActor(actor);
  return filterSidebarBoards(boards);
}

export function shouldLoadPersonalSidebarBoards(departmentId, mode) {
  return mode === 'personal' || departmentId === PERSONAL_DEPARTMENT_ID;
}
