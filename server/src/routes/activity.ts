import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/errors";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { assertBoardAccess, boardIdForCard } from "../lib/access";

const router = Router();

/** Activity history for a single card (moves, comments, updates, ...). */
router.get(
  "/cards/:cardId/activity",
  requireAuth,
  validate({
    params: z.object({ cardId: z.string().min(1) }),
    query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { cardId } = req.params as { cardId: string };
    await assertBoardAccess(user.id, await boardIdForCard(cardId));
    const activities = await prisma.activity.findMany({
      where: { cardId },
      orderBy: { createdAt: "desc" },
      take: (req.query as unknown as { limit: number }).limit,
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });
    res.json({ activities });
  }),
);

export default router;
