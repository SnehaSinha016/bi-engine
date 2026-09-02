import { Router } from "express";
import { USERS } from "../auth/users.js";
import { issueToken } from "../auth/middleware.js";

const router = Router();

router.get("/users", (req, res) => {
  res.json(USERS.map(({ id, name, role, title, regionScope, dataDetail }) => ({ id, name, role, title, regionScope, dataDetail })));
});

router.post("/login", (req, res) => {
  const { userId } = req.body;
  const token = issueToken(userId);
  if (!token) return res.status(400).json({ error: "Unknown userId" });
  const user = USERS.find((u) => u.id === userId);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, title: user.title, regionScope: user.regionScope, dataDetail: user.dataDetail } });
});

export default router;
