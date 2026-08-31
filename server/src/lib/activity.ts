import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Records an entry in the card / board activity history.
 * `type` examples: "card.created", "card.moved", "card.updated",
 * "card.archived", "comment.added", "label.added", "assignee.added",
 * "checklist.item.completed", "due.set".
 */
export async function logActivity(
  client: Client,
  params: {
    boardId: string;
    userId: string;
    type: string;
    cardId?: string | null;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await client.activity.create({
    data: {
      boardId: params.boardId,
      userId: params.userId,
      type: params.type,
      cardId: params.cardId ?? null,
      data: (params.data ?? {}) as Prisma.InputJsonValue,
    },
  });
}
