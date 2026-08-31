import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, badRequest, notFound } from "../lib/errors";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { assertBoardAccess, boardIdForList } from "../lib/access";
import { logActivity } from "../lib/activity";

const router = Router();

/** Create a list at the end of a board. */
router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({
      boardId: z.string().min(1),
      title: z.string().trim().min(1).max(120),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId, title } = req.body as { boardId: string; title: string };
    await assertBoardAccess(user.id, boardId);

    const last = await prisma.list.findFirst({
      where: { boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const list = await prisma.list.create({
      data: { boardId, title, position: (last?.position ?? 0) + 1000 },
    });
    await logActivity(prisma, { boardId, userId: user.id, type: "list.created", data: { title } });
    res.status(201).json({ list: { ...list, cards: [] } });
  }),
);

/** Reorder every list in a board. Body is the full ordered list of ids. */
router.put(
  "/reorder",
  requireAuth,
  validate({
    body: z.object({
      boardId: z.string().min(1),
      orderedIds: z.array(z.string().min(1)).min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId, orderedIds } = req.body as { boardId: string; orderedIds: string[] };
    await assertBoardAccess(user.id, boardId);

    const existing = await prisma.list.findMany({ where: { boardId }, select: { id: true } });
    const existingIds = new Set(existing.map((l) => l.id));
    if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
      throw badRequest("orderedIds must contain exactly the lists on this board");
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.list.update({ where: { id }, data: { position: (index + 1) * 1000 } }),
      ),
    );
    res.json({ ok: true });
  }),
);

router.patch(
  "/:listId",
  requireAuth,
  validate({
    params: z.object({ listId: z.string().min(1) }),
    body: z.object({
      title: z.string().trim().min(1).max(120).optional(),
      archived: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { listId } = req.params as { listId: string };
    const body = req.body as { title?: string; archived?: boolean };
    if (Object.keys(body).length === 0) throw badRequest("Nothing to update");

    const boardId = await boardIdForList(listId);
    await assertBoardAccess(user.id, boardId);

    const list = await prisma.list.update({ where: { id: listId }, data: body });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      type: "list.updated",
      data: { title: list.title, ...body },
    });
    res.json({ list });
  }),
);

router.delete(
  "/:listId",
  requireAuth,
  validate({ params: z.object({ listId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { listId } = req.params as { listId: string };
    const list = await prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw notFound("List not found");
    await assertBoardAccess(user.id, list.boardId);

    await prisma.list.delete({ where: { id: listId } });
    await logActivity(prisma, {
      boardId: list.boardId,
      userId: user.id,
      type: "list.deleted",
      data: { title: list.title },
    });
    res.json({ ok: true });
  }),
);

export default router;
