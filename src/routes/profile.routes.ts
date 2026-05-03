import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/profile.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", getProfile);
router.patch("/", updateProfile);

export default router;
