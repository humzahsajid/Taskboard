import { PrismaClient } from "@prisma/client";

// A single shared PrismaClient for the whole process.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
