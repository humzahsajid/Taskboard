import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, badRequest, notFound } from "../lib/errors";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { assertBoardAccess } from "../lib/access";

const router = Router();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value like #ef4444");

router.get(
  "/",
  requireAuth,
  validate({ query: z.object({ boardId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.query as { boardId: string };
    await assertBoardAccess(user.id, boardId);
    const labels = await prisma.label.findMany({ where: { boardId }, orderBy: { name: "asc" } });
    res.json({ labels });
  }),
);

router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({
      boardId: z.string().min(1),
      name: z.string().trim().min(1).max(40),
      color: hexColor,
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId, name, color } = req.body as { boardId: string; name: string; color: string };
    await assertBoardAccess(user.id, boardId);
    const label = await prisma.label.create({ data: { boardId, name, color } });
    res.status(201).json({ label });
  }),
);

router.patch(
  "/:labelId",
  requireAuth,
  validate({
    params: z.object({ labelId: z.string().min(1) }),
    body: z.object({
      name: z.string().trim().min(1).max(40).optional(),
      color: hexColor.optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { labelId } = req.params as { labelId: string };
    const body = req.body as { name?: string; color?: string };
    if (Object.keys(body).length === 0) throw badRequest("Nothing to update");
    const label = await prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw notFound("Label not found");
    await assertBoardAccess(user.id, label.boardId);
    const updated = await prisma.label.update({ where: { id: labelId }, data: body });
    res.json({ label: updated });
  }),
);

router.delete(
  "/:labelId",
  requireAuth,
  validate({ params: z.object({ labelId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { labelId } = req.params as { labelId: string };
    const label = await prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw notFound("Label not found");
    await assertBoardAccess(user.id, label.boardId);
    await prisma.label.delete({ where: { id: labelId } });
    res.json({ ok: true });
  }),
);

export default router;
