import express from "express";
import { login, me } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;