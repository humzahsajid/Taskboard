import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, badRequest, forbidden, notFound } from "../lib/errors";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { assertBoardAccess, boardIdForCard, boardIdForList } from "../lib/access";
import { logActivity } from "../lib/activity";
import { cardListInclude, serializeCard } from "../lib/serialize";

const router = Router();
const cardParam = z.object({ cardId: z.string().min(1) });

const fullCardInclude = {
  labels: { include: { label: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } } },
  comments: {
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  },
  checklists: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
  list: { select: { id: true, title: true, boardId: true } },
} as const;

function serializeFullCard(card: any) {
  return {
    id: card.id,
    listId: card.listId,
    list: { id: card.list.id, title: card.list.title },
    boardId: card.list.boardId,
    title: card.title,
    description: card.description,
    position: card.position,
    dueDate: card.dueDate,
    archived: card.archived,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    labels: card.labels.map((l: any) => l.label),
    assignees: card.assignees.map((a: any) => a.user),
    comments: card.comments.map((c: any) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      user: c.user,
    })),
    checklists: card.checklists.map((cl: any) => ({
      id: cl.id,
      title: cl.title,
      position: cl.position,
      items: cl.items,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Create / read / update / delete                                     */
/* ------------------------------------------------------------------ */

router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({
      listId: z.string().min(1),
      title: z.string().trim().min(1).max(280),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { listId, title } = req.body as { listId: string; title: string };
    const boardId = await boardIdForList(listId);
    await assertBoardAccess(user.id, boardId);

    const last = await prisma.card.findFirst({
      where: { listId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const card = await prisma.card.create({
      data: { listId, title, position: (last?.position ?? 0) + 1000 },
      include: cardListInclude,
    });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      type: "card.created",
      cardId: card.id,
      data: { title },
    });
    res.status(201).json({ card: serializeCard(card) });
  }),
);

router.get(
  "/:cardId",
  requireAuth,
  validate({ params: cardParam }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const card = await prisma.card.findUnique({ where: { id: cardId }, include: fullCardInclude });
    if (!card) throw notFound("Card not found");
    await assertBoardAccess(user.id, card.list.boardId);
    res.json({ card: serializeFullCard(card) });
  }),
);

router.patch(
  "/:cardId",
  requireAuth,
  validate({
    params: cardParam,
    body: z.object({
      title: z.string().trim().min(1).max(280).optional(),
      description: z.string().max(20000).optional(),
      dueDate: z.string().datetime().nullable().optional(),
      archived: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const body = req.body as {
      title?: string;
      description?: string;
      dueDate?: string | null;
      archived?: boolean;
    };
    if (Object.keys(body).length === 0) throw badRequest("Nothing to update");

    const current = await prisma.card.findUnique({
      where: { id: cardId },
      include: { list: { select: { boardId: true } } },
    });
    if (!current) throw notFound("Card not found");
    const boardId = current.list.boardId;
    await assertBoardAccess(user.id, boardId);

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.archived !== undefined) data.archived = body.archived;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const card = await prisma.card.update({
      where: { id: cardId },
      data,
      include: cardListInclude,
    });

    // Activity: record the meaningful change(s).
    if (body.archived !== undefined) {
      await logActivity(prisma, {
        boardId,
        userId: user.id,
        cardId,
        type: body.archived ? "card.archived" : "card.restored",
        data: { title: card.title },
      });
    }
    if (body.dueDate !== undefined && String(current.dueDate ?? null) !== String(data.dueDate ?? null)) {
      await logActivity(prisma, {
        boardId,
        userId: user.id,
        cardId,
        type: body.dueDate ? "due.set" : "due.cleared",
        data: { title: card.title, dueDate: data.dueDate },
      });
    }
    if (body.title !== undefined && body.title !== current.title) {
      await logActivity(prisma, {
        boardId,
        userId: user.id,
        cardId,
        type: "card.renamed",
        data: { from: current.title, to: body.title },
      });
    }
    if (body.description !== undefined && body.description !== current.description) {
      await logActivity(prisma, {
        boardId,
        userId: user.id,
        cardId,
        type: "card.description.updated",
        data: { title: card.title },
      });
    }

    res.json({ card: serializeCard(card) });
  }),
);

router.delete(
  "/:cardId",
  requireAuth,
  validate({ params: cardParam }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { list: { select: { boardId: true } } },
    });
    if (!card) throw notFound("Card not found");
    await assertBoardAccess(user.id, card.list.boardId);

    await prisma.card.delete({ where: { id: cardId } });
    await logActivity(prisma, {
      boardId: card.list.boardId,
      userId: user.id,
      type: "card.deleted",
      data: { title: card.title },
    });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Move / reorder                                                      */
/* ------------------------------------------------------------------ */

router.post(
  "/:cardId/move",
  requireAuth,
  validate({
    params: cardParam,
    body: z.object({
      toListId: z.string().min(1),
      toIndex: z.number().int().min(0),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const { toListId, toIndex } = req.body as { toListId: string; toIndex: number };

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { list: { select: { id: true, title: true, boardId: true } } },
    });
    if (!card) throw notFound("Card not found");
    const boardId = card.list.boardId;
    await assertBoardAccess(user.id, boardId);

    const targetBoardId = await boardIdForList(toListId);
    if (targetBoardId !== boardId) throw forbidden("Cannot move a card to a different board");

    const targetList = await prisma.list.findUnique({
      where: { id: toListId },
      select: { id: true, title: true },
    });
    if (!targetList) throw notFound("Target list not found");

    await prisma.$transaction(async (tx) => {
      const siblings = await tx.card.findMany({
        where: { listId: toListId, archived: false, id: { not: cardId } },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const ids = siblings.map((s) => s.id);
      const clampedIndex = Math.min(Math.max(toIndex, 0), ids.length);
      ids.splice(clampedIndex, 0, cardId);

      await Promise.all(
        ids.map((id, index) =>
          tx.card.update({
            where: { id },
            data: { position: (index + 1) * 1000, ...(id === cardId ? { listId: toListId } : {}) },
          }),
        ),
      );

      if (card.listId !== toListId) {
        await logActivity(tx, {
          boardId,
          userId: user.id,
          cardId,
          type: "card.moved",
          data: { title: card.title, from: card.list.title, to: targetList.title },
        });
      }
    });

    const updated = await prisma.card.findUnique({ where: { id: cardId }, include: cardListInclude });
    res.json({ card: serializeCard(updated!) });
  }),
);

/* ------------------------------------------------------------------ */
/* Labels on a card                                                    */
/* ------------------------------------------------------------------ */

router.post(
  "/:cardId/labels",
  requireAuth,
  validate({ params: cardParam, body: z.object({ labelId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const { labelId } = req.body as { labelId: string };
    const boardId = await boardIdForCard(cardId);
    await assertBoardAccess(user.id, boardId);

    const label = await prisma.label.findFirst({ where: { id: labelId, boardId } });
    if (!label) throw badRequest("That label does not belong to this board");

    await prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      create: { cardId, labelId },
      update: {},
    });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      cardId,
      type: "label.added",
      data: { label: label.name },
    });
    res.status(201).json({ ok: true });
  }),
);

router.delete(
  "/:cardId/labels/:labelId",
  requireAuth,
  validate({ params: cardParam.extend({ labelId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId, labelId } = req.params as { cardId: string; labelId: string };
    const boardId = await boardIdForCard(cardId);
    await assertBoardAccess(user.id, boardId);
    await prisma.cardLabel.deleteMany({ where: { cardId, labelId } });
    await logActivity(prisma, { boardId, userId: user.id, cardId, type: "label.removed" });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Assignees on a card                                                 */
/* ------------------------------------------------------------------ */

router.post(
  "/:cardId/assignees",
  requireAuth,
  validate({ params: cardParam, body: z.object({ userId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const { userId } = req.body as { userId: string };
    const boardId = await boardIdForCard(cardId);
    await assertBoardAccess(user.id, boardId);

    const isMember = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!isMember) throw badRequest("You can only assign board members — add them to the board first");

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarColor: true, email: true },
    });
    if (!target) throw notFound("User not found");

    await prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      cardId,
      type: "assignee.added",
      data: { assignee: target.name },
    });
    res.status(201).json({ assignee: target });
  }),
);

router.delete(
  "/:cardId/assignees/:userId",
  requireAuth,
  validate({ params: cardParam.extend({ userId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId, userId } = req.params as { cardId: string; userId: string };
    const boardId = await boardIdForCard(cardId);
    await assertBoardAccess(user.id, boardId);
    await prisma.cardAssignee.deleteMany({ where: { cardId, userId } });
    await logActivity(prisma, { boardId, userId: user.id, cardId, type: "assignee.removed" });
    res.json({ ok: true });
  }),
);

export default router;
