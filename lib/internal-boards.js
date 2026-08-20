/** Client/server helpers for department kanban boards. */

export const INTERNAL_BOARDS_CHANGED = 'internal-boards-changed';

export function dispatchBoardsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INTERNAL_BOARDS_CHANGED));
  }
}
