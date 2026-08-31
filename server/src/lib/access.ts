import { prisma } from "./prisma";
import { forbidden, notFound } from "./errors";

/**
 * Confirms the user can see/modify a board (owner or member).
 * Returns the membership role ("owner" | "member").
 */
export async function assertBoardAccess(userId: string, boardId: string): Promise<"owner" | "member"> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!board) throw notFound("Board not found");
  if (board.ownerId === userId) return "owner";
  if (board.members.length > 0) return (board.members[0].role as "member") ?? "member";
  throw forbidden("You are not a member of this board");
}

export async function assertBoardOwner(userId: string, boardId: string): Promise<void> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (!board) throw notFound("Board not found");
  if (board.ownerId !== userId) throw forbidden("Only the board owner can do that");
}

/** Resolves the board id that owns a given list. */
export async function boardIdForList(listId: string): Promise<string> {
  const list = await prisma.list.findUnique({ where: { id: listId }, select: { boardId: true } });
  if (!list) throw notFound("List not found");
  return list.boardId;
}

/** Resolves the board id that owns a given card. */
export async function boardIdForCard(cardId: string): Promise<string> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { boardId: true } } },
  });
  if (!card) throw notFound("Card not found");
  return card.list.boardId;
}
