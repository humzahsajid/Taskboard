import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

/**
 * Directory of accounts — used to populate "add member" and "assign card"
 * pickers. Only non-sensitive fields are returned.
 */
router.get(
  "/",
  requireAuth,
  validate({ query: z.object({ q: z.string().trim().max(80).optional() }) }),
  asyncHandler(async (req, res) => {
    const q = (req.query as { q?: string }).q;
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: { id: true, name: true, email: true, avatarColor: true },
      orderBy: { name: "asc" },
      take: 50,
    });
    res.json({ users });
  }),
);

export default router;
