import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, forbidden, notFound } from "../lib/errors";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { assertBoardAccess, boardIdForCard } from "../lib/access";
import { logActivity } from "../lib/activity";

const router = Router();

router.get(
  "/cards/:cardId/comments",
  requireAuth,
  validate({ params: z.object({ cardId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    await assertBoardAccess(user.id, await boardIdForCard(cardId));
    const comments = await prisma.comment.findMany({
      where: { cardId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });
    res.json({ comments });
  }),
);

router.post(
  "/cards/:cardId/comments",
  requireAuth,
  validate({
    params: z.object({ cardId: z.string().min(1) }),
    body: z.object({ body: z.string().trim().min(1).max(5000) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    const boardId = await boardIdForCard(cardId);
    await assertBoardAccess(user.id, boardId);

    const comment = await prisma.comment.create({
      data: { cardId, userId: user.id, body: (req.body as { body: string }).body },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      cardId,
      type: "comment.added",
      data: { preview: comment.body.slice(0, 120) },
    });
    res.status(201).json({ comment });
  }),
);

router.patch(
  "/comments/:commentId",
  requireAuth,
  validate({
    params: z.object({ commentId: z.string().min(1) }),
    body: z.object({ body: z.string().trim().min(1).max(5000) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { commentId } = req.params as { commentId: string };
    const existing = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) throw notFound("Comment not found");
    if (existing.userId !== user.id) throw forbidden("You can only edit your own comments");

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { body: (req.body as { body: string }).body },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });
    res.json({ comment });
  }),
);

router.delete(
  "/comments/:commentId",
  requireAuth,
  validate({ params: z.object({ commentId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { commentId } = req.params as { commentId: string };
    const existing = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!existing) throw notFound("Comment not found");
    if (existing.userId !== user.id) throw forbidden("You can only delete your own comments");
    await prisma.comment.delete({ where: { id: commentId } });
    res.json({ ok: true });
  }),
);

export default router;
