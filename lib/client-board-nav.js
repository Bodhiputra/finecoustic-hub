import { API_V1, unwrapData } from '@/lib/api/routes';
import { boardOriginUrl } from '@/lib/campaign-urls';

/** Resolve a board from an in-memory list or the internal boards API. */
export async function resolveBoard(boardId, knownBoards = []) {
  if (!boardId) return null;
  const local = knownBoards.find(board => board?.id === boardId);
  if (local) return local;

  try {
    const res = await fetch(API_V1.internalBoard(boardId), { credentials: 'same-origin' });
    if (!res.ok) return null;
    const body = await res.json();
    const data = unwrapData(body);
    return data?.board || null;
  } catch {
    return null;
  }
}

/** Navigate to the department (or personal) workspace that owns a board. */
export async function navigateToBoardOrigin(router, boardId, knownBoards = []) {
  const board = await resolveBoard(boardId, knownBoards);
  if (!board) return false;
  router.push(boardOriginUrl(board));
  return true;
}
