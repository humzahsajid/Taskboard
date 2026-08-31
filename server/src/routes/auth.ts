import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, badRequest, conflict, unauthorized } from "../lib/errors";
import {
  clearAuthCookie,
  hashPassword,
  setAuthCookie,
  signToken,
  verifyPassword,
} from "../lib/auth";
import { validate } from "../middleware/validate";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { rateLimit } from "express-rate-limit";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, please wait a few minutes" } },
});

const AVATAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#6366f1", "#d946ef"];

const publicUser = (u: {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
}) => ({ id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor });

router.post(
  "/register",
  authLimiter,
  validate({
    body: z.object({
      email: z.string().email().transform((s) => s.toLowerCase().trim()),
      name: z.string().trim().min(1).max(80),
      password: z.string().min(8).max(200),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { email, name, password } = req.body as {
      email: string;
      name: string;
      password: string;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("An account with that email already exists");

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      },
    });

    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicUser(user), token });
  }),
);

router.post(
  "/login",
  authLimiter,
  validate({
    body: z.object({
      email: z.string().email().transform((s) => s.toLowerCase().trim()),
      password: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json({ user: publicUser(user), token });
  }),
);

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser((req as AuthedRequest).user) });
  }),
);

router.patch(
  "/me",
  requireAuth,
  validate({
    body: z.object({
      name: z.string().trim().min(1).max(80).optional(),
      avatarColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour like #4f46e5")
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const body = req.body as { name?: string; avatarColor?: string };
    if (body.name === undefined && body.avatarColor === undefined) {
      throw badRequest("Nothing to update");
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: body });
    res.json({ user: publicUser(updated) });
  }),
);

router.patch(
  "/password",
  requireAuth,
  validate({
    body: z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(200),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthedRequest;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const full = await prisma.user.findUnique({ where: { id: user.id } });
    if (!full || !(await verifyPassword(currentPassword, full.passwordHash))) {
      throw unauthorized("Current password is incorrect");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    res.json({ ok: true });
  }),
);

export default router;
