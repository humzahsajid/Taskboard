import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, badRequest, notFound } from "../lib/errors";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { assertBoardAccess, boardIdForCard } from "../lib/access";
import { logActivity } from "../lib/activity";

const router = Router();

async function boardIdForChecklist(checklistId: string): Promise<{ boardId: string; cardId: string }> {
  const cl = await prisma.checklist.findUnique({
    where: { id: checklistId },
    select: { cardId: true, card: { select: { list: { select: { boardId: true } } } } },
  });
  if (!cl) throw notFound("Checklist not found");
  return { boardId: cl.card.list.boardId, cardId: cl.cardId };
}

/* ----- Checklists ----- */

router.post(
  "/cards/:cardId/checklists",
  requireAuth,
  validate({
    params: z.object({ cardId: z.string().min(1) }),
    body: z.object({ title: z.string().trim().min(1).max(120) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const boardId = await boardIdForCard(cardId);
    await assertBoardAccess(user.id, boardId);

    const last = await prisma.checklist.findFirst({
      where: { cardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const checklist = await prisma.checklist.create({
      data: { cardId, title: (req.body as { title: string }).title, position: (last?.position ?? 0) + 1000 },
      include: { items: true },
    });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      cardId,
      type: "checklist.added",
      data: { title: checklist.title },
    });
    res.status(201).json({ checklist });
  }),
);

router.patch(
  "/checklists/:checklistId",
  requireAuth,
  validate({
    params: z.object({ checklistId: z.string().min(1) }),
    body: z.object({ title: z.string().trim().min(1).max(120) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { checklistId } = req.params as { checklistId: string };
    const { boardId } = await boardIdForChecklist(checklistId);
    await assertBoardAccess(user.id, boardId);
    const checklist = await prisma.checklist.update({
      where: { id: checklistId },
      data: { title: (req.body as { title: string }).title },
      include: { items: { orderBy: { position: "asc" } } },
    });
    res.json({ checklist });
  }),
);

router.delete(
  "/checklists/:checklistId",
  requireAuth,
  validate({ params: z.object({ checklistId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { checklistId } = req.params as { checklistId: string };
    const { boardId } = await boardIdForChecklist(checklistId);
    await assertBoardAccess(user.id, boardId);
    await prisma.checklist.delete({ where: { id: checklistId } });
    res.json({ ok: true });
  }),
);

/* ----- Checklist items ----- */

router.post(
  "/checklists/:checklistId/items",
  requireAuth,
  validate({
    params: z.object({ checklistId: z.string().min(1) }),
    body: z.object({ text: z.string().trim().min(1).max(500) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { checklistId } = req.params as { checklistId: string };
    const { boardId } = await boardIdForChecklist(checklistId);
    await assertBoardAccess(user.id, boardId);
    const last = await prisma.checklistItem.findFirst({
      where: { checklistId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const item = await prisma.checklistItem.create({
      data: {
        checklistId,
        text: (req.body as { text: string }).text,
        position: (last?.position ?? 0) + 1000,
      },
    });
    res.status(201).json({ item });
  }),
);

router.patch(
  "/checklist-items/:itemId",
  requireAuth,
  validate({
    params: z.object({ itemId: z.string().min(1) }),
    body: z.object({
      text: z.string().trim().min(1).max(500).optional(),
      done: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { itemId } = req.params as { itemId: string };
    const body = req.body as { text?: string; done?: boolean };
    if (Object.keys(body).length === 0) throw badRequest("Nothing to update");

    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { checklistId: true },
    });
    if (!item) throw notFound("Checklist item not found");
    const { boardId, cardId } = await boardIdForChecklist(item.checklistId);
    await assertBoardAccess(user.id, boardId);

    const updated = await prisma.checklistItem.update({ where: { id: itemId }, data: body });
    if (body.done !== undefined) {
      await logActivity(prisma, {
        boardId,
        userId: user.id,
        cardId,
        type: body.done ? "checklist.item.completed" : "checklist.item.reopened",
        data: { text: updated.text },
      });
    }
    res.json({ item: updated });
  }),
);

router.delete(
  "/checklist-items/:itemId",
  requireAuth,
  validate({ params: z.object({ itemId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { itemId } = req.params as { itemId: string };
    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { checklistId: true },
    });
    if (!item) throw notFound("Checklist item not found");
    const { boardId } = await boardIdForChecklist(item.checklistId);
    await assertBoardAccess(user.id, boardId);
    await prisma.checklistItem.delete({ where: { id: itemId } });
    res.json({ ok: true });
  }),
);

export default router;
