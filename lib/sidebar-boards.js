import { KOL_OUTREACH_BOARD_ID } from '@/lib/kol-outreach-shared';

/** System boards that live under Data tools — never show in dept kanban nav. Flow picker uses `for_flow_picker=1` to include them. */
export function filterSidebarBoards(boards = []) {
  return boards.filter(board => board?.id && board.id !== KOL_OUTREACH_BOARD_ID);
}
