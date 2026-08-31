import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, badRequest, notFound } from "../lib/errors";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { assertBoardAccess, assertBoardOwner } from "../lib/access";
import { logActivity } from "../lib/activity";
import { cardListInclude, serializeCard } from "../lib/serialize";

const router = Router();

const DEFAULT_LISTS = ["To Do", "In Progress", "Done"];
const DEFAULT_LABELS = [
  { name: "Bug", color: "#ef4444" },
  { name: "Feature", color: "#22c55e" },
  { name: "Urgent", color: "#f97316" },
  { name: "Design", color: "#a855f7" },
  { name: "Docs", color: "#0ea5e9" },
];

const idParam = z.object({ boardId: z.string().min(1) });

/* ------------------------------------------------------------------ */
/* Board collection                                                    */
/* ------------------------------------------------------------------ */

router.get(
  "/",
  requireAuth,
  validate({ query: z.object({ archived: z.enum(["true", "false"]).optional() }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const archived = (req.query as { archived?: string }).archived === "true";
    const boards = await prisma.board.findMany({
      where: {
        archived,
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { id: true, name: true, avatarColor: true } },
        members: { select: { userId: true } },
        _count: { select: { lists: true } },
      },
    });
    res.json({
      boards: boards.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        archived: b.archived,
        owner: b.owner,
        isOwner: b.ownerId === user.id,
        memberCount: b.members.length,
        listCount: b._count.lists,
        updatedAt: b.updatedAt,
      })),
    });
  }),
);

router.post(
  "/",
  requireAuth,
  validate({
    body: z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { title, description } = req.body as { title: string; description?: string };

    const board = await prisma.$transaction(async (tx) => {
      const created = await tx.board.create({
        data: {
          title,
          description: description ?? "",
          ownerId: user.id,
          members: { create: { userId: user.id, role: "owner" } },
          lists: {
            create: DEFAULT_LISTS.map((t, i) => ({ title: t, position: (i + 1) * 1000 })),
          },
          labels: { create: DEFAULT_LABELS },
        },
      });
      await logActivity(tx, {
        boardId: created.id,
        userId: user.id,
        type: "board.created",
        data: { title },
      });
      return created;
    });

    res.status(201).json({ board });
  }),
);

/* ------------------------------------------------------------------ */
/* Single board                                                        */
/* ------------------------------------------------------------------ */

router.get(
  "/:boardId",
  requireAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    const role = await assertBoardAccess(user.id, boardId);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarColor: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
        },
        labels: { orderBy: { name: "asc" } },
        lists: {
          where: { archived: false },
          orderBy: { position: "asc" },
          include: {
            cards: {
              where: { archived: false },
              orderBy: { position: "asc" },
              include: cardListInclude,
            },
          },
        },
      },
    });
    if (!board) throw notFound("Board not found");

    res.json({
      board: {
        id: board.id,
        title: board.title,
        description: board.description,
        archived: board.archived,
        role,
        owner: board.owner,
        members: board.members.map((m) => ({ ...m.user, role: m.role })),
        labels: board.labels,
        lists: board.lists.map((l) => ({
          id: l.id,
          title: l.title,
          position: l.position,
          cards: l.cards.map(serializeCard),
        })),
      },
    });
  }),
);

router.patch(
  "/:boardId",
  requireAuth,
  validate({
    params: idParam,
    body: z.object({
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(2000).optional(),
      archived: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    await assertBoardAccess(user.id, boardId);
    const body = req.body as { title?: string; description?: string; archived?: boolean };
    if (Object.keys(body).length === 0) throw badRequest("Nothing to update");

    const board = await prisma.board.update({ where: { id: boardId }, data: body });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      type: body.archived === undefined ? "board.updated" : body.archived ? "board.archived" : "board.restored",
      data: body,
    });
    res.json({ board });
  }),
);

router.post(
  "/:boardId/archive",
  requireAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    await assertBoardAccess(user.id, boardId);
    const board = await prisma.board.update({ where: { id: boardId }, data: { archived: true } });
    await logActivity(prisma, { boardId, userId: user.id, type: "board.archived" });
    res.json({ board });
  }),
);

router.delete(
  "/:boardId",
  requireAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    await assertBoardOwner(user.id, boardId);
    await prisma.board.delete({ where: { id: boardId } });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

router.get(
  "/:boardId/members",
  requireAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    await assertBoardAccess(user.id, boardId);
    const members = await prisma.boardMember.findMany({
      where: { boardId },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
    });
    res.json({ members: members.map((m) => ({ ...m.user, role: m.role })) });
  }),
);

router.post(
  "/:boardId/members",
  requireAuth,
  validate({
    params: idParam,
    body: z.object({ email: z.string().email().transform((s) => s.toLowerCase().trim()) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    await assertBoardAccess(user.id, boardId);
    const { email } = req.body as { email: string };

    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) throw notFound("No account with that email — ask them to sign up first");

    await prisma.boardMember.upsert({
      where: { boardId_userId: { boardId, userId: target.id } },
      create: { boardId, userId: target.id, role: "member" },
      update: {},
    });
    await logActivity(prisma, {
      boardId,
      userId: user.id,
      type: "member.added",
      data: { memberName: target.name },
    });

    res.status(201).json({
      member: {
        id: target.id,
        name: target.name,
        email: target.email,
        avatarColor: target.avatarColor,
        role: "member",
      },
    });
  }),
);

router.delete(
  "/:boardId/members/:userId",
  requireAuth,
  validate({ params: idParam.extend({ userId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId, userId } = req.params as { boardId: string; userId: string };
    await assertBoardOwner(user.id, boardId);
    if (userId === user.id) throw badRequest("The owner cannot be removed from the board");
    await prisma.boardMember.deleteMany({ where: { boardId, userId } });
    await prisma.cardAssignee.deleteMany({
      where: { userId, card: { list: { boardId } } },
    });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

router.get(
  "/:boardId/activity",
  requireAuth,
  validate({
    params: idParam,
    query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    await assertBoardAccess(user.id, boardId);
    const limit = (req.query as unknown as { limit: number }).limit;
    const activities = await prisma.activity.findMany({
      where: { boardId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        card: { select: { id: true, title: true } },
      },
    });
    res.json({ activities });
  }),
);

/* ------------------------------------------------------------------ */
/* Search / filter                                                     */
/* ------------------------------------------------------------------ */

router.get(
  "/:boardId/search",
  requireAuth,
  validate({
    params: idParam,
    query: z.object({
      q: z.string().trim().max(120).optional(),
      labelId: z.string().optional(),
      assigneeId: z.string().optional(),
      due: z.enum(["overdue", "today", "week", "none"]).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { boardId } = req.params as { boardId: string };
    await assertBoardAccess(user.id, boardId);
    const { q, labelId, assigneeId, due } = req.query as {
      q?: string;
      labelId?: string;
      assigneeId?: string;
      due?: "overdue" | "today" | "week" | "none";
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    let dueFilter: Record<string, unknown> | undefined;
    if (due === "overdue") dueFilter = { dueDate: { lt: now } };
    else if (due === "today") dueFilter = { dueDate: { gte: startOfToday, lt: endOfToday } };
    else if (due === "week") dueFilter = { dueDate: { gte: startOfToday, lt: endOfWeek } };
    else if (due === "none") dueFilter = { dueDate: null };

    const cards = await prisma.card.findMany({
      where: {
        archived: false,
        list: { boardId, archived: false },
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(labelId ? { labels: { some: { labelId } } } : {}),
        ...(assigneeId ? { assignees: { some: { userId: assigneeId } } } : {}),
        ...(dueFilter ?? {}),
      },
      orderBy: [{ list: { position: "asc" } }, { position: "asc" }],
      include: { ...cardListInclude, list: { select: { id: true, title: true } } },
    });

    res.json({
      results: cards.map((c) => ({ ...serializeCard(c), list: c.list })),
    });
  }),
);

export default router;
