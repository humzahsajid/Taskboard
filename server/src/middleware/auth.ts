import type { NextFunction, Request, Response } from "express";
import { COOKIE_NAME, verifyToken } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { unauthorized } from "../lib/errors";

export interface AuthedRequest extends Request {
  user: { id: string; email: string; name: string; avatarColor: string };
}

/** Rejects the request unless a valid login token is present. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = req.cookies?.[COOKIE_NAME] ?? bearer;
    if (!token) throw unauthorized();

    const payload = verifyToken(token);
    if (!payload) throw unauthorized("Session expired, please log in again");

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, avatarColor: true },
    });
    if (!user) throw unauthorized();

    (req as AuthedRequest).user = user;
    next();
  } catch (err) {
    next(err);
  }
}
