import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import { env } from "./env";
import api from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  // Behind the nginx reverse proxy in Docker.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  // Global safety net against abuse.
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use("/api", api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
