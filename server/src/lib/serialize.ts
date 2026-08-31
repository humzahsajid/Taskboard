import type { Prisma } from "@prisma/client";

/** Shape of a card as sent to the frontend for the board view. */
export const cardListInclude = {
  labels: { include: { label: true } },
  assignees: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
  checklists: { select: { items: { select: { done: true } } } },
  _count: { select: { comments: true } },
} satisfies Prisma.CardInclude;

type CardWithIncludes = Prisma.CardGetPayload<{ include: typeof cardListInclude }>;

export function serializeCard(card: CardWithIncludes) {
  const checklistItems = card.checklists.flatMap((c) => c.items);
  return {
    id: card.id,
    listId: card.listId,
    title: card.title,
    description: card.description,
    position: card.position,
    dueDate: card.dueDate,
    archived: card.archived,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    labels: card.labels.map((l) => l.label),
    assignees: card.assignees.map((a) => a.user),
    commentCount: card._count.comments,
    checklist: {
      total: checklistItems.length,
      done: checklistItems.filter((i) => i.done).length,
    },
  };
}
