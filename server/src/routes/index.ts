import { Router } from "express";
import auth from "./auth";
import users from "./users";
import boards from "./boards";
import lists from "./lists";
import cards from "./cards";
import labels from "./labels";
import comments from "./comments";
import checklists from "./checklists";
import activity from "./activity";

const api = Router();

api.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

api.use("/auth", auth);
api.use("/users", users);
api.use("/boards", boards);
api.use("/lists", lists);
api.use("/cards", cards);
api.use("/labels", labels);
api.use("/", comments);
api.use("/", checklists);
api.use("/", activity);

export default api;
