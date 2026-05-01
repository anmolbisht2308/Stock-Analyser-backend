import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "../controllers/watchlist.controller";

const router = Router();

router.use(requireAuth);

router.get("/", getWatchlist);
router.post("/", addToWatchlist);
router.delete("/:symbol", removeFromWatchlist);

export default router;
